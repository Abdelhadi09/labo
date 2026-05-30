# BioLab Analyse — Déploiement Azure

## Architecture

```
├── backend/          → Node.js + Express (Azure Web App)
├── frontend/         → React + Vite (Azure Web App ou Static Web Apps)
├── azure/            → Scripts et configurations Azure
```

---

## Prérequis

- Azure CLI installé (`az --version`)
- Node.js 18+
- Compte Azure actif

---

## 1. Créer les ressources Azure

### Groupe de ressources
```bash
az group create --name rg-biolab --location francecentral
```

### Azure SQL Server & Database
```bash
# Créer le serveur SQL
az sql server create \
  --name biolab-sql-server \
  --resource-group rg-biolab \
  --location francecentral \
  --admin-user labadmin \
  --admin-password "VotreMotDePasse123!"

# Autoriser l'accès Azure (pour les Web Apps)
az sql server firewall-rule create \
  --resource-group rg-biolab \
  --server biolab-sql-server \
  --name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# Créer la base de données
az sql db create \
  --resource-group rg-biolab \
  --server biolab-sql-server \
  --name labanalysis \
  --service-objective S0
```

### Azure Blob Storage
```bash
# Créer le compte de stockage
az storage account create \
  --name biolabstorage \
  --resource-group rg-biolab \
  --location francecentral \
  --sku Standard_LRS \
  --kind StorageV2

# Créer le conteneur pour les ordonnances
az storage container create \
  --name ordonnances \
  --account-name biolabstorage \
  --public-access blob

# Obtenir la chaîne de connexion
az storage account show-connection-string \
  --name biolabstorage \
  --resource-group rg-biolab
```

---

## 2. Déployer le Backend (Azure Web App)

### Créer l'App Service Plan et la Web App
```bash
az appservice plan create \
  --name biolab-plan \
  --resource-group rg-biolab \
  --sku B1 \
  --is-linux

az webapp create \
  --resource-group rg-biolab \
  --plan biolab-plan \
  --name biolab-backend \
  --runtime "NODE:18-lts"
```

### Configurer les variables d'environnement
```bash
az webapp config appsettings set \
  --resource-group rg-biolab \
  --name biolab-backend \
  --settings \
    DB_SERVER="biolab-sql-server.database.windows.net" \
    DB_NAME="labanalysis" \
    DB_USER="labadmin" \
    DB_PASSWORD="VotreMotDePasse123!" \
    DB_PORT="1433" \
    AZURE_STORAGE_CONNECTION_STRING="<votre_connection_string>" \
    AZURE_STORAGE_CONTAINER_NAME="ordonnances" \
    JWT_SECRET="<votre_jwt_secret_tres_long_et_aleatoire>" \
    JWT_EXPIRES_IN="24h" \
    FRONTEND_URL="https://biolab-frontend.azurewebsites.net" \
    NODE_ENV="production"
```

### Déployer via ZIP
```bash
cd backend
npm install --production
zip -r ../backend.zip . -x "node_modules/*" ".env"
az webapp deployment source config-zip \
  --resource-group rg-biolab \
  --name biolab-backend \
  --src ../backend.zip
```

---

## 3. Déployer le Frontend (Azure Static Web Apps ou Web App)

### Option A: Azure Static Web Apps (recommandé)
```bash
az staticwebapp create \
  --name biolab-frontend \
  --resource-group rg-biolab \
  --location "westeurope" \
  --source https://github.com/votre-username/votre-repo \
  --branch main \
  --app-location "frontend" \
  --output-location "dist"
```

### Option B: Web App classique
```bash
cd frontend
echo "VITE_API_URL=https://biolab-backend.azurewebsites.net/api" > .env.production
npm install
npm run build

# Créer une Web App pour le frontend
az webapp create \
  --resource-group rg-biolab \
  --plan biolab-plan \
  --name biolab-frontend \
  --runtime "NODE:18-lts"

# Déployer le build
zip -r ../frontend.zip dist/
az webapp deployment source config-zip \
  --resource-group rg-biolab \
  --name biolab-frontend \
  --src ../frontend.zip
```

---

## 4. Variables d'environnement — Référence

### Backend `.env`
```
DB_SERVER=your-server.database.windows.net
DB_NAME=labanalysis
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_PORT=1433
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;...
AZURE_STORAGE_CONTAINER_NAME=ordonnances
JWT_SECRET=votre-secret-jwt-tres-securise
JWT_EXPIRES_IN=24h
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://biolab-frontend.azurewebsites.net
```

### Frontend `.env.production`
```
VITE_API_URL=https://biolab-backend.azurewebsites.net/api
```

---

## 5. Démarrage local

```bash
# Backend
cd backend
cp .env.example .env    # Remplissez les valeurs
npm install
npm run dev

# Frontend (autre terminal)
cd frontend
cp .env.example .env
npm install
npm run dev
```

Accès local :
- Frontend : http://localhost:5173
- Backend API : http://localhost:5000/api

---

## Comptes de test

Créez vos comptes via l'interface `/register` :
- Sélectionnez **Client** pour l'interface patient
- Sélectionnez **Technicien** pour l'interface laboratoire

---

## Services disponibles

| Code | Nom | Prix |
|------|-----|------|
| VIT_D | 25-Hydroxy Vitamine D | 2 450 DA |
| ACE | Antigène Carcino-Embryonnaire | 1 450 DA |
| ACR | Albumine Créatinine Ratio | 1 250 DA |
| AFP | Alpha Fœtoprotéine | 1 350 DA |
