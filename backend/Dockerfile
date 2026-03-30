FROM python:3.11-slim

# Set working directory inside container
WORKDIR /app

# Copy dependencies first (better layer caching)
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your app
COPY . .

# Expose the port FastAPI will run on
EXPOSE 8000

# Start the app
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
