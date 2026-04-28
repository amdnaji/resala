# Installation Guide - Resala

Resala supports two installation methods: **Standard (Manual)** and **Docker**.

## Option 1: Standard Installation (Manual)

### Prerequisites
- **.NET SDK 9.0**
- **Node.js 20+** & **npm**
- **PostgreSQL 15+**

### 1. Database Setup
1. Install PostgreSQL and create a database named `resala_chat`.
2. Update the connection string in `src/Resala.Backend/appsettings.json`:
   ```json
   "ConnectionStrings": {
     "DefaultConnection": "Host=localhost;Database=resala_chat;Username=postgres;Password=YOUR_PASSWORD"
   }
   ```

### 2. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd src/Resala.Backend
   ```
2. Restore and run the application:
   ```bash
   dotnet run
   ```
   *The backend will be available at `http://localhost:8080` (or as configured).*

### 3. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd src/resala.client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   *The frontend will be available at `http://localhost:5173`.*

---

## Option 2: Docker Installation (Recommended)

### Prerequisites
- **Docker** & **Docker Compose**

### Steps
1. Navigate to the root folder of the project.
2. Run the following command:
   ```bash
   docker-compose up --build -d
   ```
3. This will start three containers:
   - **resala-db**: PostgreSQL database.
   - **resala-backend**: .NET 9 API.
   - **resala-frontend**: React/Vite app served by Nginx.

### Access
- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:8080`

### Configuration
You can modify environment variables in `docker-compose.yml` to change database credentials or storage paths.
