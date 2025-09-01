#Instructions for putting the app in a "container" so it can run anywhere on the internet

FROM python:3.11-slim

WORKDIR /app

#copy all requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

#copy my app
COPY . .

#expose port (Cloud Run sets the PORT environment variable)
EXPOSE 8080

#run FAST API
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]