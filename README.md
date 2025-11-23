Prueba Técnica – Backend Senior (Node.js + MySQL + Docker + Lambda)

Este repositorio contiene la solución completa para la prueba técnica solicitada:

- Customers API (Node.js + Express + MySQL)
- Orders API (Node.js + Express + MySQL)
- Lambda Orchestrator (Serverless Framework + Node 22)
- MySQL 8 con schema.sql y seed.sql
- Docker Compose para levantar todo el entorno
- Documentación y ejemplos de pruebas (cURL + Postman)

📂 Estructura del Monorepo

/prueba-tecnica
 ├── customers-api/
 │    ├── src/
 │    ├── openapi.yaml
 │    ├── Dockerfile
 │    └── .env.example
 ├── orders-api/
 │    ├── src/
 │    ├── openapi.yaml
 │    ├── Dockerfile
 │    └── .env.example
 ├── lambda-orchestrator/
 │    ├── handler.js
 │    ├── serverless.yml
 │    └── .env.example
 ├── db/
 │    ├── schema.sql
 │    └── seed.sql
 └── docker-compose.yml

🛠️ Requisitos Previos

- Docker Desktop (Windows/Mac) o Docker Engine (Linux)
- Node.js 20+ o 22 instalado
- Serverless Framework:
    npm install -g serverless
    npm install -g serverless-offline
🚀 Docker
    docker compose build
    docker compose up -d

🌐 Endpoints Principales
Customers API → http://localhost:3001
Orders API → http://localhost:3002
Orchestrator Lambda → http://localhost:3000 (via serverless-offline)
🔑 Credenciales iniciales
Email: admin@example.com
Password: admin123

🧪 Pruebas — Customers API
1. Login (obtener JWT)
    POST http://localhost:3001/auth/login
    Content-Type: application/json

    {
    "email": "admin@example.com",
    "password": "admin123"
    }
2. Obtener clientes
    GET http://localhost:3001/customers
    Authorization: Bearer <TOKEN>
3. Endpoint interno
    GET http://localhost:3001/internal/customers/1
    Authorization: Bearer super_secret_service_token

📦 Pruebas — Orders API
1. Login
    POST http://localhost:3002/auth/login
2. Ver productos
    GET http://localhost:3002/products
    Authorization: Bearer <TOKEN_ORDERS>
3. Crear orden
    POST http://localhost:3002/orders
    Authorization: Bearer <TOKEN>
    Content-Type: application/json

    {
    "customer_id": 1,
    "items": [
        { "product_id": 2, "qty": 3 }
    ]
    }
4. Confirmar orden (idempotencia)
    POST http://localhost:3002/orders/2/confirm
    Authorization: Bearer <TOKEN>
    X-Idempotency-Key: key-001

🌩️ Probar Lambda Orchestrator
1. Levantar el orquestador
    cd lambda-orchestrator
    npm install
    npm run dev
2. Invocar el flujo completo
    POST http://localhost:3000/orchestrator/create-and-confirm-order
    Content-Type: application/json

    {
    "customer_id": 1,
    "items": [
        { "product_id": 2, "qty": 3 }
    ],
    "idempotency_key": "abc-123",
    "correlation_id": "req-789"
    }









