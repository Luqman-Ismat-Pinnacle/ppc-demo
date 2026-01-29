import os
import traceback
import tempfile
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import jpype
import mpxj

def init_jvm():
    """Start the JVM if not already started."""
    if not jpype.isJVMStarted():
        try:
            jpype.startJVM("-Xmx512m", convertStrings=True)
            print("JVM started successfully.")
        except Exception as e:
            print(f"JVM Startup Error: {e}")
            return False
    return True

app = Flask(__name__)
CORS(app)

class ProjectParser:
    def __init__(self):
        """Initialize the UniversalProjectReader."""
        from org.mpxj.reader import UniversalProjectReader
        self.reader = UniversalProjectReader()

    def _to_iso(self, j_date):
        """Convert Java date to ISO string or return None."""
        if not j_date:
            return None
        try:
            return str(j_date.toString())
        except Exception:
            return None

    def _to_float(self, val):
        """Convert value to float or return 0.0."""
        if val is None:
            return 0.0
        try:
            if hasattr(val, 'doubleValue'):
                return float(val.doubleValue())
            return float(val)
        except Exception:
            return 0.0

    def parse_file(self, path):
        """Parse an MPP file and return project data."""
        try:
            project = self.reader.read(path)
        except Exception as e:
            print(f"Error reading project file: {e}")
            return {"success": False, "error": f"Error reading project file: {e}"}

        # Run CPM Analyzer if available
        try:
            from org.mpxj.scheduling import CriticalPathMethodAnalyzer
            analyzer = CriticalPathMethodAnalyzer()
            analyzer.schedule(project)
        except ImportError:
            print("Scheduling analyzer not found; continuing with raw data.")
        except Exception as e:
            print(f"Scheduling analyzer error: {e}")

        # Project properties
        props = project.getProjectProperties()
        project_info = {
            'name': str(props.getProjectTitle() or "Imported Project"),
            'startDate': self._to_iso(props.getStartDate()),
            'endDate': self._to_iso(props.getFinishDate()),
            'manager': str(props.getManager() or "")
        }

        # Process tasks
        all_tasks = []
        tasks = project.getTasks()
        
        for task in tasks:
            uid = str(task.getUniqueID())
            name = str(task.getName() or "")
            level = int(task.getOutlineLevel() or 0)
            
            is_summary = bool(task.getSummary())
            parent_task = task.getParentTask()
            parent_id = str(parent_task.getUniqueID()) if parent_task and parent_task.getUniqueID() else None

            # Resource assignments
            res_names = []
            assignments = task.getResourceAssignments()
            if assignments:
                for a in assignments:
                    r = a.getResource()
                    if r:
                        res_names.append(str(r.getName() or ""))
            assigned_resource = ", ".join(filter(None, res_names))

            # Hours calculation
            total_work = self._to_float(task.getWork().getDuration()) if task.getWork() else 0.0
            actual_work = self._to_float(task.getActualWork().getDuration()) if task.getActualWork() else 0.0
            remaining_hours = max(0, total_work - actual_work)

            task_data = {
                'id': uid,
                'name': name,
                'outline_level': level,
                'is_summary': is_summary,
                'parent_id': parent_id,
                'startDate': self._to_iso(task.getStart()),
                'endDate': self._to_iso(task.getFinish()),
                'percentComplete': self._to_float(task.getPercentageComplete()),
                'baselineHours': self._to_float(task.getBaselineWork().getDuration()) if task.getBaselineWork() else 0.0,
                'actualHours': actual_work,
                'projectedHours': total_work,
                'remainingHours': remaining_hours,
                'assignedResource': assigned_resource,
                'isCritical': bool(task.getCritical()),
                'totalSlack': self._to_float(task.getTotalSlack().getDuration()) if task.getTotalSlack() else 0.0,
                'comments': str(task.getNotes() or "")
            }
            all_tasks.append(task_data)

        return {
            'success': True,
            'project': project_info,
            'tasks': all_tasks,
            'summary': {
                'total_rows': len(all_tasks)
            }
        }

@app.route('/')
def ui():
    return render_template('index.html')

@app.route('/health')
def health(): return jsonify(status="ok", version="v13-cpm-ui")

@app.route('/parse', methods=['POST'])
def parse():
    f = request.files.get('file')
    if not f: return jsonify(success=False, error="No file uploaded"), 400
    if not init_jvm(): return jsonify(success=False, error="JVM Init Failed"), 500

    try:
        with tempfile.NamedTemporaryFile(suffix=".mpp", delete=False) as t:
            f.save(t.name)
            res = ProjectParser().parse_file(t.name)
        os.remove(t.name)
        return jsonify(res)
    except Exception as e:
        traceback.print_exc()
        return jsonify(success=False, error=str(e)), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)