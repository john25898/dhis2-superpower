# CHAK VISTA — Run Locally (for the person hosting)

## Quick start

1. Install **Python 3.10 or newer** from https://www.python.org/downloads/
   - **Important:** during install tick **"Add Python to PATH"**
2. Double-click **`start.bat`** in this `train` folder
   - It installs dependencies (first time only) and starts the server
3. Open **http://localhost:5100** in your browser

## Manual start (if start.bat fails)

Open PowerShell in this `train` folder and run:

```powershell
python --version                 # must be Python 3.10+
pip install -r requirements.txt  # install dependencies
python run_flask.py 5100         # start server
```

You should see `Running on http://0.0.0.0:5100` in the terminal. **Keep that window open.**

## Common errors

| Symptom                                          | Cause                                                   | Fix                                                                         |
| ------------------------------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| `ModuleNotFoundError: No module named 'flask'`   | Installed the wrong requirements file (root, not train) | `pip install -r requirements.txt` **inside the train folder**               |
| `'python' is not recognized`                     | Python not in PATH                                      | Reinstall Python, tick "Add Python to PATH"                                 |
| Terminal shows Running but browser can't connect | Browser opened before server ready, or firewall         | Wait 5s, refresh. Check Windows Firewall → allow Python on private networks |
| `Address already in use`                         | Port 5100 busy                                          | `python run_flask.py 5101` and open http://localhost:5101                   |
| `cannot connect` from ANOTHER computer           | `localhost` only works on the hosting PC                | Use `http://<this-computer-IP>:5100` instead                                |

## Test the server (optional)

After starting, in a **second** terminal:

```powershell
curl http://localhost:5100/api/dashboard-data
```

If you see JSON output, the server is fine. If it errors, the server is down — read the error in the server terminal.

## Notes

- `.env` files already contain the KHIS credentials, so no setup needed.
- Internet connection is required (charts load from CDN, live data from KHIS).
