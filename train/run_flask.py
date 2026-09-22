"""Run the Flask app from the train directory."""
import sys
import os

# Ensure we're in the train directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Remove any cached imports of the wrong app module
for modname in list(sys.modules.keys()):
    if 'app' in modname:
        del sys.modules[modname]

# app.py already builds and exposes a module-level `app`; importing it runs
# create_app() exactly once.  Calling create_app() again here built the whole
# app (and re-registered every blueprint, re-reading the metadata CSVs) a
# second time — ~1.7 s of pure waste on every local start.
from app import app

port = int(os.environ.get("FLASK_PORT", sys.argv[1] if len(sys.argv) > 1 else "5000"))
app.run(host='0.0.0.0', port=port, debug=False)
