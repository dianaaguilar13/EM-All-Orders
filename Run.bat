@echo off
cd /d "%~dp0"

echo Running Snowflake refresh...
python refresh_bti_data.py
if %errorlevel% neq 0 (
    echo Script failed. No changes committed.
    pause
    exit /b 1
)

echo Committing updated data to GitHub...
git add ar_data.json ar2_data.json cr_data.json data.json ldp_data.json pif_data.json pif_rows.json
git commit -m "Refresh dashboard data %date% %time%"
git push origin main

echo Done. Data pushed to GitHub.
pause