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

from app import create_app

app = create_app()
app.run(host='0.0.0.0', port=5000, debug=False)
