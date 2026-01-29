
// Workday Projects Sync Edge Function
// Optimized: Parallel Fetching, Standard IDs, Robust Mapping
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// URLs
const URL_PARENT_PHASE = 'https://services1.myworkday.com/ccx/service/customreport2/pinnacle/mandie.burnett/RPT_-_View_Project_Plan_-_Integration_for_Parent_Phase?Include_Subordinate_Project_Hierarchies=1&Projects_and_Project_Hierarchies%21WID=6c3abbb4fb20100174cf1f0f36850000&format=json';
const URL_INTEGRATION = 'https://services1.myworkday.com/ccx/service/customreport2/pinnacle/mandie.burnett/RPT_-_View_Project_Plan_-_Integration?Include_Subordinate_Project_Hierarchies=1&Projects_and_Project_Hierarchies%21WID=6c3abbb4fb20100174cf1f0f36850000&format=json';
const URL_FIND_PROJECTS = 'https://services1.myworkday.com/ccx/service/customreport2/pinnacle/ISU_PowerBI_HCM/RPT_-_Find_Projects_-_Pinnacle?Projects_and_Project_Hierarchies%21WID=6c3abbb4fb20100174cf1f0f36850000&Include_Subordinate_Project_Hierarchies=1&Billable=0&Capital=0&Inactive=0&Status%21WID=8114d1e7d62810016e8dbc4118e60000!8114d1e7d62810016e8dbba72b880000!758d94cc846601c5404e6ab4e2135430!8114d1e7d62810016e8dbb0d64800000!874d109880b8100105bee5e42fde0000!8114d1e7d62810016e8dbba72b880001&format=json';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    console.log('[workday-projects] === Function Started ===');

    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const workdayUser = Deno.env.get('WORKDAY_ISU_USER');
        const workdayPass = Deno.env.get('WORKDAY_ISU_PASS');
        const supabase = createClient(supabaseUrl, supabaseKey);

        if (!workdayUser || !workdayPass) throw new Error('Workday credentials missing');

        const credentials = btoa(`${workdayUser}:${workdayPass}`);
        const fetchConfig = { headers: { 'Authorization': `Basic ${credentials}`, 'Accept': 'application/json' } };

        // Helper to upsert batches
        const upsertBatch = async (table: string, items: any[]) => {
            if (items.length === 0) return;
            const BATCH_SIZE = 500;
            console.log(`[workday-projects] Upserting ${items.length} records to ${table}...`);
            for (let i = 0; i < items.length; i += BATCH_SIZE) {
                const batch = items.slice(i, i + BATCH_SIZE);
                const { error } = await supabase.from(table).upsert(batch, { onConflict: 'id' });
                if (error) {
                    console.error(`[workday-projects] Upsert error ${table}:`, error.message);
                    // Log fail but don't crash entire process? OR throw to fail explicitly?
                    // Throwing ensures we know it failed.
                    throw new Error(`${table} upsert failed: ${error.message}`);
                }
            }
        };

        // PARALLEL FETCH: Fetch all 3 reports simultaneously
        // SEQUENTIAL FETCH: Fetch reports one by one to avoid memory/connection limits
        console.log('[workday-projects] Fetching Find Projects Report...');
        const resMaster = await fetch(URL_FIND_PROJECTS, fetchConfig);
        if (!resMaster.ok) throw new Error(`Failed to fetch Find Projects: ${resMaster.statusText}`);
        const dataMaster = await resMaster.json();

        console.log('[workday-projects] Fetching Integration Report...');
        const resIntegration = await fetch(URL_INTEGRATION, fetchConfig);
        if (!resIntegration.ok) throw new Error(`Failed to fetch Integration Report: ${resIntegration.statusText}`);
        const dataIntegration = await resIntegration.json();

        console.log('[workday-projects] Fetching Parent Phase Report...');
        const resHier = await fetch(URL_PARENT_PHASE, fetchConfig);
        if (!resHier.ok) throw new Error(`Failed to fetch Parent Phase Report: ${resHier.statusText}`);
        const dataHier = await resHier.json();

        console.log('[workday-projects] Data Fetched. Processing...');

        // --- STEP 1: PROCESSING MASTER DATA (Portfolios, Customers, Sites) ---
        const masterRecords = dataMaster.Report_Entry || [];
        const customersToUpsert = new Map();
        const sitesToUpsert = new Map();
        const portfoliosToUpsert = new Map();
        const projectMasterData = new Map();

        const generateId = (prefix: string, name: string) => {
            const slug = name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 30);
            return `${prefix}-${slug}`; // CHANGED to standard format "PRF-XYZ"
        };

        for (const r of masterRecords) {
            const pidRaw = r.Project_by_ID || '';
            const idMatch = pidRaw.match(/^(\d+)/);
            const projectId = idMatch ? idMatch[1] : pidRaw;
            if (!projectId) continue;

            const custName = r.CF_Customer_Site_Ref_ID || r.Customer;
            const siteName = r.CF_Project_Site_Ref_ID || r.Site;
            const pmName = r.CF_ARI_Sr_Project_Manager;
            const portfolioMgr = r.Optional_Project_Hierarchies;
            const billableStr = r.Primary_Project_Hierarchy;
            const isActiveCode = r['Inactive_-_Current'];

            // Portfolio (PRF-)
            let portfolioId = null;
            if (portfolioMgr) {
                portfolioId = generateId('PRF', portfolioMgr);
                if (!portfoliosToUpsert.has(portfolioId)) {
                    portfoliosToUpsert.set(portfolioId, {
                        id: portfolioId,
                        portfolioId: portfolioId, // Standard schema field
                        name: `${portfolioMgr}'s Portfolio`,
                        manager: portfolioMgr,
                        is_active: true,
                        createdAt: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    });
                }
            }

            // Customer (CST-)
            let custId = null;
            if (custName) {
                custId = generateId('CST', custName);
                if (!customersToUpsert.has(custId)) {
                    customersToUpsert.set(custId, {
                        id: custId,
                        customer_id: custId,
                        name: custName,
                        portfolio_id: portfolioId,
                        is_active: true,
                        updated_at: new Date().toISOString()
                    });
                }
            }

            // Site (STE-)
            let siteId = null;
            if (siteName) {
                siteId = generateId('STE', siteName);
                if (!sitesToUpsert.has(siteId)) {
                    sitesToUpsert.set(siteId, {
                        id: siteId,
                        site_id: siteId,
                        name: siteName,
                        customer_id: custId,
                        location: r.Location,
                        is_active: true,
                        updated_at: new Date().toISOString()
                    });
                }
            }

            projectMasterData.set(projectId, {
                customer_id: custId,
                site_id: siteId,
                portfolio_id: portfolioId,
                manager: pmName,
                billable_type: (billableStr && billableStr.includes('Fixed Price')) ? 'FP' : 'T&M',
                methodology: r.Project_Groups,
                baseline_start: r.Start_Date,
                baseline_end: r.End_Date,
                is_active: isActiveCode === '0'
            });
        }

        // --- STEP 2: PROCESSING INTEGRATION METADATA (Dates, Hours) ---
        const integrationRecords = dataIntegration.Report_Entry || [];
        const subPhaseMeta = new Map();
        const projectDateAgg = new Map();

        for (const m of integrationRecords) {
            const spid = m.Project_Plan_Phase_ID__Column_J;
            const pidRaw = m.Project_ID__Column_F || '';
            if (!spid || !pidRaw) continue;

            // Dates
            const s = m['Start_Date__YYYY-MM-DD___Column_T'];
            const e = m['End_Date__YYYY-MM-DD___Column_U'];

            if (!subPhaseMeta.has(spid)) {
                subPhaseMeta.set(spid, { est: 0, act: 0, closed: true, start: null, end: null });
            }
            const existing = subPhaseMeta.get(spid);

            // Bounds logic
            if (s && (!existing.start || s < existing.start)) existing.start = s;
            if (e && (!existing.end || e > existing.end)) existing.end = e;

            existing.est += parseFloat(m.Task_Estimated_Hours || '0');
            existing.act += parseFloat(m.Total_Hours_Worked || '0');
            if (m.Closed__Column_Y === '0') existing.closed = false;

            // Project Aggregation
            if (!projectDateAgg.has(pidRaw)) {
                projectDateAgg.set(pidRaw, { start: null, end: null, is_active: false });
            }
            const pMeta = projectDateAgg.get(pidRaw);
            if (s && (!pMeta.start || s < pMeta.start)) pMeta.start = s;
            if (e && (!pMeta.end || e > pMeta.end)) pMeta.end = e;
            if (m.Closed__Column_Y === '0') pMeta.is_active = true;
        }

        // --- STEP 3: HIERARCHY (Skipped - Sync Only Portfolios, Customers, Sites) ---
        // const hierarchyRecords = dataHier.Report_Entry || [];
        // Loop removed as requested. Only syncing top-level entities from Master Data.

        // --- STEP 4: BATCH UPSERTS ---
        // Order: Portfolios -> Customers -> Sites
        console.log('[workday-projects] Upserting Hierarchies (Portfolios, Customers, Sites)...');
        if (portfoliosToUpsert.size > 0) await upsertBatch('portfolios', Array.from(portfoliosToUpsert.values()));
        if (customersToUpsert.size > 0) await upsertBatch('customers', Array.from(customersToUpsert.values()));
        if (sitesToUpsert.size > 0) await upsertBatch('sites', Array.from(sitesToUpsert.values()));

        return new Response(
            JSON.stringify({
                success: true,
                summary: {
                    portfolios: portfoliosToUpsert.size,
                    customers: customersToUpsert.size,
                    sites: sitesToUpsert.size,
                    master_data_matched: 0
                }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        console.error('[workday-projects] Error:', error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
