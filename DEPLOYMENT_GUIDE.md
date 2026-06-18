# 🚀 Kompletný Deployment Guide: K3s vs Kamal

> **Fullstack aplikácia (NestJS + React/Vite + PostgreSQL)**
> Tento dokument je kompletný sprievodca nasadením od nuly až do produkcie.
> Určený pre tím, ktorý dostane prázdny VM (on-premise) a potrebuje nasadiť celú aplikáciu.

---

## 📑 Obsah

1. [Architektúra projektu](#-1-architektúra-projektu)
2. [K3s vs Kamal — Kedy čo použiť](#-2-k3s-vs-kamal--kedy-čo-použiť)
3. [Spoločné predpoklady (platí pre obe riešenia)](#-3-spoločné-predpoklady)
4. [CESTA A — Nasadenie cez K3s (Kubernetes)](#-cesta-a--nasadenie-cez-k3s-kubernetes)
5. [CESTA B — Nasadenie cez Kamal v2](#-cesta-b--nasadenie-cez-kamal-v2)
6. [Nasadenie novej verzie (Update workflow)](#-6-nasadenie-novej-verzie-update-workflow)
7. [Produkčné odporúčania (On-Premise VM)](#-7-produkčné-odporúčania-on-premise-vm)
8. [Troubleshooting — Časté problémy a riešenia](#-8-troubleshooting--časté-problémy-a-riešenia)
9. [Užitočné príkazy (Cheat Sheet)](#-9-užitočné-príkazy-cheat-sheet)

---

## 🏗 1. Architektúra projektu

Naša aplikácia pozostáva z **3 služieb (services)**:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│    Backend      │────▶│   PostgreSQL    │
│  React + Vite   │     │    NestJS       │     │   Databáza      │
│  (NGINX :80)    │     │   (Node :3000)  │     │   (:5432)       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
   Používateľ              REST API              Uloženie dát
   vidí toto               (JSON)                (persistentné)
```

### Štruktúra súborov

```
docker-task-project/
├── backend/                    # NestJS REST API
│   ├── src/
│   │   ├── main.ts             # Vstupný bod, CORS, port
│   │   ├── app.module.ts       # TypeORM pripojenie na PostgreSQL
│   │   └── tasks/              # CRUD modul pre úlohy
│   │       ├── task.entity.ts  # DB schéma (id, text, priority, isCompleted, createdAt)
│   │       ├── tasks.service.ts
│   │       ├── tasks.controller.ts
│   │       └── tasks.module.ts
│   ├── Dockerfile              # Multi-stage build (builder → production)
│   └── package.json
│
├── frontend/                   # React + Vite SPA
│   ├── src/
│   │   ├── App.tsx             # Hlavný komponent s API volaním
│   │   └── main.tsx
│   ├── Dockerfile              # Multi-stage build (builder → NGINX)
│   └── package.json
│
├── k8s/                        # K3s/Kubernetes manifesty
│   ├── postgres-pvc.yaml       # Persistentný volume pre DB
│   ├── postgres-deployment.yaml
│   ├── postgres-service.yaml   # ClusterIP (interná služba)
│   ├── backend-deployment.yaml
│   ├── backend-service.yaml    # LoadBalancer (verejná)
│   ├── frontend-deployment.yaml
│   └── frontend-service.yaml   # LoadBalancer (verejná)
│
├── config/                     # Kamal v2 konfigurácia
│   ├── deploy.backend.yml      # Backend + PostgreSQL (accessory)
│   └── deploy.frontend.yml     # Frontend
│
├── .kamal/
│   └── secrets                 # Heslá pre Kamal (Docker Hub token, DB heslo)
│
├── docker-compose.yml          # Lokálny vývoj (všetko jedným príkazom)
└── .gitignore
```


---

## ⚖ 2. K3s vs Kamal — Kedy čo použiť

### Čo je K3s?
**K3s** je odľahčená distribúcia Kubernetes od Rancher (SUSE). Je to plnohodnotný Kubernetes klaster v jedinom binárnom súbore (~60MB). Ideálny pre edge computing, IoT, malé servery a on-premise nasadenia.

### Čo je Kamal?
**Kamal v2** je deployment nástroj od Basecamp (tvorcovia Ruby on Rails). Nasadzuje Docker kontajnery priamo na server cez SSH bez potreby orchestrátora. Je to "zero-downtime deploy" nástroj, ktorý je extrémne jednoduchý na nastavenie.

### Porovnávacia tabuľka

| Kritérium | K3s (Kubernetes) | Kamal v2 |
|---|---|---|
| **Zložitosť nastavenia** | 🟡 Stredná — treba pochopiť K8s koncepty (Pods, Services, Deployments, PVC) | 🟢 Nízka — stačí jeden YAML súbor a príkaz `kamal setup` |
| **Krivka učenia** | 🔴 Strmá — Kubernetes má veľa konceptov | 🟢 Plochá — ak poznáš Docker, zvládneš aj Kamal |
| **Škálovanie (scaling)** | 🟢 Natívne — `kubectl scale deployment backend --replicas=5` | 🟡 Manuálne — treba pridať viac serverov do konfigurácie |
| **Self-healing** | 🟢 Automatické — ak pod spadne, K8s ho automaticky reštartuje a presťahuje | 🟡 Čiastočné — Docker `restart: unless-stopped` |
| **Zero-downtime deploy** | 🟢 Natívne — Rolling Updates sú default | 🟢 Natívne — Kamal to robí automaticky cez kamal-proxy |
| **Load Balancing** | 🟢 Built-in (K3s má Traefik + ServiceLB) | 🟡 Jednoduchý — kamal-proxy na jednom serveri |
| **Monitoring / Observabilita** | 🟢 Ecosystem (Prometheus, Grafana, Lens) | 🟡 Základné — `kamal app logs`, Docker logs |
| **Správa secrets** | 🟢 K8s Secrets (šifrované, RBAC) | 🟡 `.kamal/secrets` súbor (plain text lokálne) |
| **Multi-server** | 🟢 Natívne — viac nodov v klastri | 🟢 Podporované — zoznam hostov v YAML |
| **Rollback** | 🟢 `kubectl rollout undo deployment/backend` | 🟢 `kamal rollback <verzia>` |
| **SSL/HTTPS** | 🟢 Cert-manager + Let's Encrypt (automatické) | 🟢 Built-in cez kamal-proxy + Let's Encrypt |
| **CI/CD integrácia** | 🟢 GitOps (ArgoCD, FluxCD) | 🟢 Jednoduché — `kamal deploy` v CI pipeline |
| **Vhodné pre** | Väčšie projekty, mikroservisy, tímy, produkcia s vysokou dostupnosťou | Menšie/stredné projekty, rýchle nasadenie, malé tímy |
| **Cena (náklady)** | 🟡 Vyššia RAM/CPU réžia (~512MB pre K3s samotný) | 🟢 Minimálna réžia — len Docker daemon |
| **On-premise VM** | 🟢 Perfektné — K3s je na to navrhnutý | 🟢 Perfektné — len SSH prístup a Docker |

### 🎯 Naše odporúčanie

| Scenár | Odporúčame |
|---|---|
| Firemný klient, 1 server, jednoduché nasadenie | **Kamal** — rýchlejšie, menej údržby |
| Firemný klient, potrebuje HA (high availability) | **K3s** — automatické self-healing, škálovanie |
| Malý tím (1-3 ľudia), malý projekt | **Kamal** — menej overheadu |
| Väčší tím, viac mikroservísov | **K3s** — lepšia správa a prehľad |
| Rýchly prototyp, chceš deploy za 10 minút | **Kamal** — najrýchlejšie na nastavenie |

---

## 🔧 3. Spoločné predpoklady

Tieto kroky platia **pre obe cesty** (K3s aj Kamal):

### 3.1 Čo potrebuješ na svojom PC (lokálne)

```bash
# 1. Git (verziovanie kódu)
git --version      # Mal by byť nainštalovaný

# 2. Docker Desktop (alebo Docker Engine)
docker --version   # Minimálne v20+
docker compose version  # Pre lokálny vývoj

# 3. Node.js (pre lokálny vývoj bez Dockeru)
node --version     # v18+ alebo v20+
```

### 3.2 Čo potrebuješ na serveri (VM)

Klient ti dá prázdny VM. Požadované minimum:
- **OS:** Ubuntu 22.04 LTS alebo 24.04 LTS (odporúčané)
- **RAM:** Minimálne 2GB (4GB odporúčané)
- **CPU:** Minimálne 2 jadrá
- **Disk:** Minimálne 20GB
- **Sieť:** Verejná IP alebo prístupná IP v lokálnej sieti
- **SSH prístup:** Root alebo sudo používateľ

### 3.3 Príprava servera (prvé pripojenie)

```bash
# Pripojiť sa na server
ssh root@<IP_SERVERA>

# Aktualizovať systém
apt update && apt upgrade -y

# Nainštalovať základné nástroje
apt install -y curl wget git ufw

# Nastaviť firewall (UFW)
ufw allow OpenSSH
ufw allow 80/tcp      # HTTP
ufw allow 443/tcp     # HTTPS
ufw allow 3000/tcp    # Backend API
ufw allow 8080/tcp    # Frontend (ak nie je na 80)
ufw enable

# Overiť
ufw status
```

### 3.4 Príprava Git repozitára

```bash
# Na lokálnom PC
cd docker-task-project

# Inicializácia (ak ešte nie je)
git init
git add .
git commit -m "Initial commit: Full-stack app with Docker support"

# Pridať remote (GitHub/GitLab/Bitbucket)
git remote add origin https://github.com/<tvoj-ucet>/docker-task-project.git
git push -u origin main
```

### 3.5 Docker Hub (registry pre Docker obrazy)

Obe riešenia potrebujú miesto, kde budú uložené Docker obrazy:

```bash
# Vytvoriť účet na https://hub.docker.com
# Prihlásiť sa lokálne
docker login
# Zadať username a access token (nie heslo!)

# Vytvoriť Access Token:
# Docker Hub → Account Settings → Security → New Access Token
```

### 3.6 Build a Push Docker obrazov (manuálny postup)

```bash
# Backend
docker build -t <dockerhub_user>/docker-task-backend:latest ./backend
docker push <dockerhub_user>/docker-task-backend:latest

# Frontend (pozor na build arg!)
docker build \
  --build-arg VITE_API_URL=http://<IP_SERVERA>:3000 \
  -t <dockerhub_user>/docker-task-frontend:latest \
  ./frontend
docker push <dockerhub_user>/docker-task-frontend:latest
```

> ⚠️ **DÔLEŽITÉ**: Pri frontende MUSÍŠ zadať `VITE_API_URL` s adresou servera, kde beží backend. Toto sa "vpečie" do výsledného JavaScript kódu. Backend to nepotrebuje — čítá premenné prostredia pri štarte.

---

## ⛵ CESTA A — Nasadenie cez K3s (Kubernetes)

### A.1 — Inštalácia K3s na server

```bash
# SSH na server
ssh root@<IP_SERVERA>

# Jednoriadková inštalácia K3s
curl -sfL https://get.k3s.io | sh -

# Overiť, že K3s beží
systemctl status k3s

# Overiť, že kubectl funguje
kubectl get nodes
# Mal by sa zobraziť tvoj node v stave "Ready"

# Overiť, že všetky systémové pody bežia
kubectl get pods -A
```

> K3s automaticky nainštaluje: kubectl, containerd, Traefik (ingress), CoreDNS, ServiceLB (load balancer). Netreba nič inštalovať navyše!

### A.2 — Konfigurácia K8s manifestov

Naše manifesty sa nachádzajú v priečinku `k8s/`. Tu je vysvetlenie každého súboru:

#### 📁 `k8s/postgres-pvc.yaml` — Trvalé úložisko pre databázu
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
spec:
  accessModes:
    - ReadWriteOnce    # Len jeden pod naraz môže zapisovať
  resources:
    requests:
      storage: 1Gi     # Požadovaná veľkosť (zvýšiť podľa potreby)
```
→ **Čo to robí**: Zabezpečuje, že dáta v PostgreSQL prežijú reštart podu. Bez tohto by sa pri reštarte databázy všetky dáta stratili!

#### 📁 `k8s/postgres-deployment.yaml` — PostgreSQL pod
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres-deployment
spec:
  replicas: 1           # Vždy len 1 inštancia databázy
  selector:
    matchLabels:
      app: postgres
  template:
    spec:
      containers:
        - name: postgres
          image: postgres:15-alpine
          ports:
            - containerPort: 5432
          env:
            - name: POSTGRES_USER
              value: "postgres"
            - name: POSTGRES_PASSWORD
              value: "postgres"      # ⚠️ V produkcii zmeniť na silné heslo!
            - name: POSTGRES_DB
              value: "postgres"
          volumeMounts:
            - name: postgres-storage
              mountPath: /var/lib/postgresql/data
      volumes:
        - name: postgres-storage
          persistentVolumeClaim:
            claimName: postgres-pvc  # Odkaz na PVC vyššie
```

#### 📁 `k8s/postgres-service.yaml` — Interná služba pre DB
```yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres-service  # Toto meno používa backend ako DB_HOST
spec:
  selector:
    app: postgres
  ports:
    - port: 5432
  type: ClusterIP          # Len interná, nedostupná zvonku = bezpečnejšie
```
→ **ClusterIP** znamená, že databáza NIE JE prístupná z internetu. Len backend sa k nej vie pripojiť cez interný DNS meno `postgres-service`.

#### 📁 `k8s/backend-deployment.yaml` — NestJS API pod
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend-deployment
spec:
  replicas: 1
  template:
    spec:
      containers:
        - name: backend
          image: adoosdeveloper/docker-task-backend:latest
          imagePullPolicy: Always   # Vždy stiahni najnovší image
          ports:
            - containerPort: 3000
          env:
            - name: PORT
              value: "3000"
            - name: DB_HOST
              value: "postgres-service"  # Interný DNS meno z postgres-service.yaml
            - name: DB_PORT
              value: "5432"
            - name: DB_USERNAME
              value: "postgres"
            - name: DB_PASSWORD
              value: "postgres"          # ⚠️ V produkcii použiť K8s Secret
            - name: DB_DATABASE
              value: "postgres"
```

#### 📁 `k8s/backend-service.yaml` — Verejná služba pre API
```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend-service
spec:
  type: LoadBalancer    # Dostupný zvonku na porte 3000
  selector:
    app: backend
  ports:
    - port: 3000
      targetPort: 3000
```

#### 📁 `k8s/frontend-deployment.yaml` — React/NGINX pod
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend-deployment
spec:
  replicas: 1
  template:
    spec:
      containers:
        - name: frontend
          image: adoosdeveloper/docker-task-frontend:latest
          imagePullPolicy: Always
          ports:
            - containerPort: 80
```

#### 📁 `k8s/frontend-service.yaml` — Verejná služba pre web
```yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend-service
spec:
  type: LoadBalancer    # Dostupný zvonku na porte 8080
  selector:
    app: frontend
  ports:
    - port: 8080
      targetPort: 80    # NGINX v kontajneri počúva na 80
```

### A.3 — Nasadenie na server (prvýkrát)

```bash
# 1. Skopírovať k8s/ priečinok na server (z lokálneho PC)
scp -r k8s/ root@<IP_SERVERA>:/root/k8s/

# 2. SSH na server
ssh root@<IP_SERVERA>

# 3. Aplikovať VŠETKY manifesty naraz
kubectl apply -f /root/k8s/

# 4. Počkať kým budú všetky pody "Running"
kubectl get pods -w
# (Ctrl+C keď sú všetky Running)

# 5. Overiť služby
kubectl get svc
# Zobrazí porty a IP adresy
```

### A.4 — Overenie, že všetko funguje

```bash
# Na serveri:
# Overiť pody
kubectl get pods
# Všetky by mali mať STATUS: Running

# Overiť služby
kubectl get svc
# frontend-service   LoadBalancer   ...   8080:XXXXX/TCP
# backend-service    LoadBalancer   ...   3000:XXXXX/TCP
# postgres-service   ClusterIP      ...   5432/TCP

# Logy backendu (ak niečo nefunguje)
kubectl logs deployment/backend-deployment

# Logy databázy
kubectl logs deployment/postgres-deployment

# Test API z príkazového riadku
curl http://localhost:3000/tasks
# Mal by vrátiť [] (prázdny zoznam)
```

**Z prehliadača:**
- Frontend: `http://<IP_SERVERA>:8080`
- Backend API: `http://<IP_SERVERA>:3000/tasks`

---

## ☄️ CESTA B — Nasadenie cez Kamal v2

### B.1 — Inštalácia Kamal (na lokálnom PC, NIE na serveri)

Kamal sa inštaluje na **tvojom počítači**, nie na serveri. Kamal sa sám pripojí na server cez SSH.

```bash
# Inštalácia cez Ruby gem (potrebuješ Ruby 3.0+)
gem install kamal

# Overenie
kamal version
# Mal by vypísať verziu 2.x

# Alternatívne (ak nemáš Ruby):
# Použiť Docker image:
# docker run -it ghcr.io/basecamp/kamal:latest version
```

> **Na Windows**: Odporúčame používať WSL2 (Windows Subsystem for Linux) pre Kamal. Ruby na Windows priamo vie byť problematický.

### B.2 — Príprava servera (Kamal to spraví za teba)

Kamal vyžaduje na serveri len:
1. **SSH prístup** (root alebo sudo)
2. **Docker** — Kamal ho nainštaluje automaticky pri prvom `kamal setup`!



### B.3 — Konfiguračné súbory

#### 📁 `config/deploy.backend.yml` — Backend + Databáza
```yaml
# Meno služby (unikátne pre tento server)
service: docker-task-backend

# Docker Hub image
image: adoosdeveloper/docker-task-backend

# Na akom serveri bežať
servers:
  web:
    hosts:
      - <IP_SERVERA>          # ← Zmeniť na IP klientovho servera
    proxy: false               # Nepoužívame kamal-proxy, manuálne mapujeme porty
    options:
      publish:
        - "3000:3000"          # Mapovanie portov (host:kontajner)

# Prihlasovacie údaje na Docker Hub
registry:
  username: <dockerhub_user>   # ← Tvoj Docker Hub username
  password:
    - KAMAL_REGISTRY_PASSWORD  # Číta sa z .kamal/secrets

# Ako buildovať
builder:
  arch: amd64                  # Architektúra servera (amd64 pre väčšinu VM)
  context: ./backend           # Cesta k zdrojákom
  dockerfile: ./backend/Dockerfile

# Premenné prostredia pre kontajner
env:
  clear:                       # Verejné premenné (viditeľné v konfigurácii)
    PORT: 3000
    DB_HOST: docker-task-backend-db  # Meno databázového kontajnera (Kamal ho vytvorí)
    DB_PORT: 5432
    DB_USERNAME: postgres
    DB_DATABASE: postgres
  secret:                      # Tajné premenné (z .kamal/secrets)
    - DB_PASSWORD

# PostgreSQL databáza ako "príslušenstvo" (accessory)
accessories:
  db:
    image: postgres:15-alpine
    host: <IP_SERVERA>         # ← Zmeniť na IP klientovho servera
    port: 5432:5432
    env:
      clear:
        POSTGRES_USER: postgres
        POSTGRES_DB: postgres
      secret:
        - POSTGRES_PASSWORD    # Heslá z .kamal/secrets
    directories:
      - /var/lib/postgresql/data:/var/lib/postgresql/data  # Trvalé úložisko
```

#### 📁 `config/deploy.frontend.yml` — Frontend
```yaml
service: docker-task-frontend
image: adoosdeveloper/docker-task-frontend

servers:
  web:
    hosts:
      - <IP_SERVERA>          # ← Zmeniť na IP klientovho servera
    proxy: false
    options:
      publish:
        - "8080:80"            # Frontend NGINX počúva na 80, zvonku na 8080

registry:
  username: <dockerhub_user>
  password:
    - KAMAL_REGISTRY_PASSWORD

builder:
  arch: amd64
  context: ./frontend
  dockerfile: ./frontend/Dockerfile
  args:
    VITE_API_URL: http://<IP_SERVERA>:3000  # ← Backend URL (build-time!)
```

#### 📁 `.kamal/secrets` — Tajné heslá
```bash
# ⚠️ NIKDY NECOMMITOVAŤ DO GITU! (je v .gitignore)
KAMAL_REGISTRY_PASSWORD=<tvoj_docker_hub_access_token>
DB_PASSWORD=<silne_heslo_pre_databazu>
POSTGRES_PASSWORD=<rovnake_heslo_ako_DB_PASSWORD>
```

### B.4 — Nasadenie na server (prvýkrát)

```bash
# 1. Najprv nasadiť backend + databázu
kamal setup -c config/deploy.backend.yml
# Toto:
# - Nainštaluje Docker na server (ak ešte nie je)
# - Buildne backend Docker image lokálne
# - Pushne ho na Docker Hub
# - Stiahne ho na server
# - Spustí PostgreSQL kontajner (accessory)
# - Spustí backend kontajner
# - Prepojí ich cez Docker network

# 2. Potom nasadiť frontend
kamal setup -c config/deploy.frontend.yml
# Toto:
# - Buildne frontend image (s VITE_API_URL vpečeným pri builde)
# - Pushne na Docker Hub
# - Stiahne na server a spustí
```

### B.5 — Overenie, že všetko funguje

```bash
# Logy backendu
kamal app logs -c config/deploy.backend.yml

# Logy frontendu
kamal app logs -c config/deploy.frontend.yml

# Zoznam kontajnerov na serveri
kamal app details -c config/deploy.backend.yml

# Alebo cez SSH na server:
ssh root@<IP_SERVERA>
docker ps   # Zobrazí bežiace kontajnery
```

**Z prehliadača:**
- Frontend: `http://<IP_SERVERA>:8080`
- Backend API: `http://<IP_SERVERA>:3000/tasks`

---

## 🔄 6. Nasadenie novej verzie (Update workflow)

### Scenár: Zmenili sme kód (napr. pridali novú funkciu)

#### Git workflow (platí pre obe cesty)
```bash
# Na lokálnom PC
git add .
git commit -m "feat: pridaná nová funkcia"
git push origin main
```

---

### 🔄 Update cez K3s

```bash
# KROK 1: Buildnúť nové Docker obrazy lokálne
docker build -t <dockerhub_user>/docker-task-backend:latest ./backend
docker build \
  --build-arg VITE_API_URL=http://<IP_SERVERA>:3000 \
  -t <dockerhub_user>/docker-task-frontend:latest \
  ./frontend

# KROK 2: Pushnúť na Docker Hub
docker push <dockerhub_user>/docker-task-backend:latest
docker push <dockerhub_user>/docker-task-frontend:latest

# KROK 3: SSH na server a reštartovať pody (aby stiahli nový image)
ssh root@<IP_SERVERA>
kubectl rollout restart deployment backend-deployment
kubectl rollout restart deployment frontend-deployment

# KROK 4: Overiť, že nové pody bežia
kubectl get pods -w
kubectl rollout status deployment backend-deployment
```

> **Ak si zmenil aj K8s manifesty** (napr. pridaná nová env premenná):
> ```bash
> scp -r k8s/ root@<IP_SERVERA>:/root/k8s/
> ssh root@<IP_SERVERA>
> kubectl apply -f /root/k8s/
> ```

---

### 🔄 Update cez Kamal

```bash
# Všetko jedným príkazom z lokálneho PC:

# Backend (build + push + deploy automaticky)
kamal deploy -c config/deploy.backend.yml

# Frontend (build + push + deploy automaticky)
kamal deploy -c config/deploy.frontend.yml
```

> **To je celé!** Kamal automaticky:
> 1. Zbuilduje nový Docker image
> 2. Pushne na Docker Hub
> 3. SSH sa na server
> 4. Stiahne nový image
> 5. Spustí nový kontajner
> 6. Počká kým je "healthy"
> 7. Zastaví starý kontajner
> → Zero-downtime deploy

---

### Porovnanie update workflow

| Krok | K3s | Kamal |
|---|---|---|
| Build image | Manuálne (`docker build`) | Automaticky |
| Push na Docker Hub | Manuálne (`docker push`) | Automaticky |
| Pripojenie na server | Manuálne (`ssh`) | Automaticky |
| Reštart služieb | Manuálne (`kubectl rollout restart`) | Automaticky |
| **Počet príkazov** | **4-6 príkazov** | **1 príkaz** |
| Zero-downtime | Áno (rolling update) | Áno (kamal-proxy) |
| Rollback | `kubectl rollout undo deployment/backend` | `kamal rollback <verzia>` |

---

## 🏭 7. Produkčné odporúčania (On-Premise VM)

### 7.1 Bezpečnosť (KRITICKÉ pre produkciu!)

#### ❌ Čo NIKDY nerobiť v produkcii
```yaml
# ❌ ZLEJ: Heslá priamo v YAML súboroch
DB_PASSWORD: "postgres"       # NIKDY!
POSTGRES_PASSWORD: "postgres" # NIKDY!

# ❌ ZLE: synchronize: true v TypeORM
synchronize: true  # Toto v produkcii VYPNÚŤ!
# Automaticky mení DB schému — môže zmazať dáta!

# ❌ ZLE: CORS origin: '*'
origin: '*'  # V produkcii nastaviť na konkrétnu doménu
```

#### ✅ Čo robiť v produkcii

**1. Silné heslá pre databázu**
```bash
# Vygenerovať silné heslo
openssl rand -base64 32
# Napríklad: xK8mPqR7vN2wLfJ9hYcT6bDgA3iS5uZ0eQnWoXpMrI=
```

**2. K8s Secrets namiesto plain-text hesiel (pre K3s)**
```bash
# Vytvoriť secret na serveri
kubectl create secret generic db-credentials \
  --from-literal=DB_PASSWORD='xK8mPqR7vN2wLfJ...' \
  --from-literal=POSTGRES_PASSWORD='xK8mPqR7vN2wLfJ...'

# V deployment.yaml použiť:
env:
  - name: DB_PASSWORD
    valueFrom:
      secretKeyRef:
        name: db-credentials
        key: DB_PASSWORD
```

**3. Vypnúť TypeORM synchronize**
```typescript
// backend/src/app.module.ts
TypeOrmModule.forRoot({
  // ...
  synchronize: false,  // ← V produkcii VŽDY false
  // Použiť migrácie namiesto toho:
  // migrations: ['dist/migrations/*.js'],
  // migrationsRun: true,
})
```

**4. CORS — nastaviť konkrétnu doménu**
```typescript
// backend/src/main.ts
app.enableCors({
  origin: ['https://app.klient-domena.sk', 'http://<IP_SERVERA>:8080'],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
});
```

### 7.2 HTTPS / SSL certifikát

#### Pre K3s (cert-manager + Let's Encrypt)
```bash
# Nainštalovať cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.0/cert-manager.yaml

# Vytvoriť ClusterIssuer pre Let's Encrypt
# (vyžaduje doménu namiesto IP adresy)
```

#### Pre Kamal (automatické cez kamal-proxy)
```yaml
# config/deploy.backend.yml
servers:
  web:
    hosts:
      - <IP_SERVERA>
    proxy:
      ssl: true
      host: api.klient-domena.sk  # Doména namiesto IP
```

> ⚠️ **Pre SSL/HTTPS potrebuješ doménu** (napr. `app.firma.sk`), nie len IP adresu. Let's Encrypt nevydá certifikát na IP.

### 7.3 Zálohovanie databázy

```bash
# === Manuálny backup ===

# Pre K3s:
kubectl exec deployment/postgres-deployment -- \
  pg_dump -U postgres postgres > backup_$(date +%Y%m%d).sql

# Pre Kamal:
ssh root@<IP_SERVERA>
docker exec docker-task-backend-db \
  pg_dump -U postgres postgres > backup_$(date +%Y%m%d).sql

# === Automatický backup (cron na serveri) ===
# Pridať do crontab:
crontab -e
# Pridať riadok (záloha každý deň o 2:00):
0 2 * * * docker exec docker-task-backend-db pg_dump -U postgres postgres > /backups/backup_$(date +\%Y\%m\%d).sql
```

### 7.4 Monitoring

#### Pre K3s
```bash
# Základné monitorovanie
kubectl top pods          # CPU a RAM usage
kubectl top nodes         # Node resources

# Pokročilé: Nainštalovať Lens (desktop app pre K8s)
# https://k8slens.dev/
```

#### Pre Kamal
```bash
# Logy
kamal app logs -c config/deploy.backend.yml --follow

# Na serveri
docker stats              # Real-time CPU/RAM pre kontajnery
```

---

## 🔥 8. Troubleshooting — Časté problémy a riešenia

### 🔴 Problem: Backend sa nepripojí na databázu

**Symptóm:** `ERROR: password authentication failed for user "postgres"`

**Príčina:** Heslo v backend env premenných sa nezhoduje s heslom nastaveným v PostgreSQL.

**Riešenie:**
```bash
# Pre K3s — skontrolovať env premenné:
kubectl describe pod <backend-pod-name>
# Overiť, že DB_PASSWORD = POSTGRES_PASSWORD

# Pre Kamal — skontrolovať .kamal/secrets:
cat .kamal/secrets
# Overiť, že DB_PASSWORD = POSTGRES_PASSWORD
```

---

### 🔴 Problem: Backend nemôže nájsť databázu (connection refused)

**Symptóm:** `ECONNREFUSED 127.0.0.1:5432`

**Príčina:** Backend sa snaží pripojiť na `localhost` namiesto na databázový kontajner.

**Riešenie:**
```bash
# Pre K3s — DB_HOST musí byť názov služby:
DB_HOST: "postgres-service"     # NIE localhost!

# Pre Kamal — DB_HOST musí byť názov kontajnera:
DB_HOST: "docker-task-backend-db"  # NIE localhost!
```

---

### 🔴 Problem: Frontend ukazuje "Could not load tasks from API"

**Symptóm:** Frontend sa načíta, ale nezobrazuje žiadne dáta.

**Príčina:** `VITE_API_URL` je nastavená na nesprávnu adresu (napr. `localhost:3000` namiesto IP servera).

**Riešenie:**
```bash
# Frontend musí mať VITE_API_URL nastavenú na VEREJNÚ adresu backendu
# Pretože frontend beží v prehliadači POUŽÍVATEĽA, nie na serveri!

# Znovu zbuildovať frontend s correct URL:
docker build \
  --build-arg VITE_API_URL=http://<IP_SERVERA>:3000 \
  -t <user>/docker-task-frontend:latest ./frontend
docker push <user>/docker-task-frontend:latest

# Pre K3s: kubectl rollout restart deployment frontend-deployment
# Pre Kamal: kamal deploy -c config/deploy.frontend.yml
```

---

### 🔴 Problem: Pod je v stave CrashLoopBackOff (K3s)

**Symptóm:** `kubectl get pods` ukazuje STATUS: CrashLoopBackOff

**Príčina:** Kontajner sa spúšťa, padne, a Kubernetes ho opakovane reštartuje.

**Riešenie:**
```bash
# 1. Pozrieť logy
kubectl logs <pod-name>
kubectl logs <pod-name> --previous  # Logy z predchádzajúceho (spadnutého) podu

# 2. Popisať pod (detailné info o chybách)
kubectl describe pod <pod-name>

# 3. Najčastejšie príčiny:
# - Chýba env premenná
# - Databáza ešte nebeží (backend sa spustí skôr ako postgres)
# - Chybný image (nová verzia kódu má bug)
```

---

### 🔴 Problem: `kamal deploy` zlyhá s "Failed to boot"

**Symptóm:** Kamal hlási "First web container is unhealthy"

**Príčina:** Kontajner sa spustil, ale Kamal nevie overiť, že je "zdravý" (health check zlyhal).

**Riešenie:**
```bash
# 1. Pozrieť logy zlyhávajúceho kontajnera
kamal app logs -c config/deploy.backend.yml

# 2. Ak je proxy: false, Kamal nemá health check endpoint
# → Kontajner musí naštartovať a začať počúvať na porte do 30s

# 3. Skúsiť SSH na server a ručne spustiť kontajner:
ssh root@<IP_SERVERA>
docker ps -a  # Pozrieť na stopped kontajnery
docker logs <container_id>
```

---

### 🔴 Problem: `kubectl apply` nefunguje (K3s)

**Symptóm:** `The connection to the server localhost:6443 was refused`

**Príčina:** K3s služba nebeží.

**Riešenie:**
```bash
# Skontrolovať stav K3s
systemctl status k3s

# Reštartovať K3s
systemctl restart k3s

# Ak stále nefunguje, skontrolovať logy
journalctl -u k3s -f
```

---

### 🔴 Problem: Stará verzia sa stále zobrazuje

**Symptóm:** Po deploy novej verzie frontend stále ukazuje starú verziu.

**Príčina:** Cache prehliadača alebo starý Docker image.

**Riešenie:**
```bash
# 1. Vyčistiť cache prehliadača (Ctrl+Shift+R alebo Ctrl+F5)

# 2. Pre K3s — overiť, že imagePullPolicy je "Always":
# V deployment.yaml musí byť:
imagePullPolicy: Always

# 3. Overiť verziu bežiaceho image:
# K3s:
kubectl describe pod <pod-name> | grep Image
# Kamal:
kamal app details -c config/deploy.frontend.yml
```

---

### 🔴 Problem: Docker Hub rate limit

**Symptóm:** `toomanyrequests: You have reached your pull rate limit`

**Príčina:** Docker Hub má limit na anonymné sťahovania (100 pulls / 6h).

**Riešenie:**
```bash
# Prihlásiť sa na Docker Hub aj na serveri:
# K3s: Vytvoriť imagePullSecret
kubectl create secret docker-registry dockerhub-creds \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username=<user> \
  --docker-password=<token>

# V deployment.yaml pridať:
spec:
  template:
    spec:
      imagePullSecrets:
        - name: dockerhub-creds

# Kamal: Automaticky sa prihlasuje cez registry config
```

---

## 📋 9. Užitočné príkazy (Cheat Sheet)

### K3s / kubectl príkazy

| Príkaz | Popis |
|---|---|
| `kubectl get pods` | Zobrazí všetky pody |
| `kubectl get svc` | Zobrazí služby a ich porty |
| `kubectl get deployments` | Zobrazí deployments |
| `kubectl logs <pod>` | Logy konkrétneho podu |
| `kubectl logs -f deployment/backend-deployment` | Live logy |
| `kubectl describe pod <pod>` | Detailný popis podu |
| `kubectl apply -f k8s/` | Aplikovať všetky manifesty |
| `kubectl delete -f k8s/` | Zmazať všetky manifesty |
| `kubectl rollout restart deployment <name>` | Reštartovať deployment |
| `kubectl rollout undo deployment <name>` | Rollback na predchádzajúcu verziu |
| `kubectl scale deployment <name> --replicas=3` | Škálovať na 3 inštancie |
| `kubectl exec -it <pod> -- /bin/sh` | SSH do podu |
| `kubectl top pods` | CPU/RAM usage podov |
| `kubectl get events --sort-by=.metadata.creationTimestamp` | Udalosti (debugging) |

### Kamal príkazy

| Príkaz | Popis |
|---|---|
| `kamal setup -c config/deploy.backend.yml` | Prvé nasadenie (setup servera + deploy) |
| `kamal deploy -c config/deploy.backend.yml` | Nasadiť novú verziu |
| `kamal app logs -c config/deploy.backend.yml` | Logy aplikácie |
| `kamal app logs -f -c config/deploy.backend.yml` | Live logy |
| `kamal app details -c config/deploy.backend.yml` | Detail bežiacich kontajnerov |
| `kamal app exec -c config/deploy.backend.yml -- bin/sh` | SSH do kontajnera |
| `kamal rollback <verzia> -c config/deploy.backend.yml` | Rollback |
| `kamal env push -c config/deploy.backend.yml` | Aktualizovať env premenné |
| `kamal accessory logs db -c config/deploy.backend.yml` | Logy databázy |
| `kamal accessory reboot db -c config/deploy.backend.yml` | Reštartovať databázu |
| `kamal audit -c config/deploy.backend.yml` | Audit log nasadení |
| `kamal lock release -c config/deploy.backend.yml` | Odblokovať zamknutý deploy |

### Docker príkazy (univerzálne)

| Príkaz | Popis |
|---|---|
| `docker ps` | Bežiace kontajnery |
| `docker ps -a` | Všetky kontajnery (aj zastavené) |
| `docker logs <container>` | Logy kontajnera |
| `docker stats` | Real-time metriky |
| `docker exec -it <container> /bin/sh` | Shell v kontajneri |
| `docker system prune -af` | Vyčistiť nepoužívané obrazy/kontajnery |
| `docker compose up -d` | Spustiť lokálny vývoj |
| `docker compose down` | Zastaviť lokálny vývoj |

---

## 📌 Záver — Quick Decision Guide

```
Dostali sme prázdny VM od klienta. Čo zvoliť?
│
├── Jednoduchý projekt, malý tím, chceme rýchlo nasadiť?
│   └── → KAMAL ☄️ (menej overhead, 1 príkaz na deploy)
│
├── Klient požaduje Kubernetes / HA / škálovanie?
│   └── → K3S ⛵ (plnohodnotný K8s, enterprise-ready)
│
├── Projekt bude rásť, viac mikroservísov v budúcnosti?
│   └── → K3S ⛵ (lepšie spravovateľný pri raste)
│
└── Nevieme sa rozhodnúť?
    └── → Začať s KAMAL (jednoduchšie), migrovať na K3s keď bude treba
```

---

> 📝 **Tento dokument vytvoril**: Deployment Guide pre interný tím
> 📅 **Posledná aktualizácia**: Jún 2026
> 🏗️ **Projekt**: docker-task-project (NestJS + React + PostgreSQL)
