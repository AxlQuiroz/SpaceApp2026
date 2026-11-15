FROM python:3.12-slim
WORKDIR /app
COPY requirements.lock .
RUN pip install --no-cache-dir -r requirements.lock
COPY pyproject.toml .
COPY src ./src
RUN pip install --no-cache-dir --no-deps . \
    && useradd --create-home --uid 10001 orbita \
    && mkdir -p /app/data \
    && chown -R orbita:orbita /app/data
USER orbita
EXPOSE 8001
CMD ["python", "-m", "uvicorn", "resource_api.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8001"]
