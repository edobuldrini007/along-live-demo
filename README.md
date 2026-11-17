# ALONG — Live Classroom Demo

Interactive smart-neighbourhood prototype for CA3342 at CityUHK, piloted conceptually at Wah Fu Estate. Residents join by QR code and choose Chess or Market, origin building, time, preferred walking pace, and optional first name/nickname. Only members of the same group can view each other's names. A presenter dashboard shows groups and visualizes simulated movements.

## Deploy to Render
Python web service, build `pip install -r requirements.txt`, start `uvicorn server:app --host 0.0.0.0 --port $PORT --workers 1 --no-access-log`, use **one worker**. Health endpoint: `/api/health`. Presenter dashboard: `/presenter`.

Group records are held in memory and disappear after a server restart/sleep. Do not use for actual navigation; pedestrian routes and accessibility have not been surveyed. Weather is obtained from the Hong Kong Observatory public feed when available.
