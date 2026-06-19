# 🚀 Od Classic K8s po Kustomize — Kompletný sprievodca migráciou

> **Projekt:** docker-task-project (NestJS + React/Vite + PostgreSQL)
> **Infraštruktúra:** K3s na DigitalOcean VPS (164.92.244.115)
> **Domény:** dev/test/prod.adrianprogramuje.sk (SSL cez Let's Encrypt + Traefik)
> **Docker Hub:** adoosdeveloper/docker-task-test (súkromný repozitár)

---

## 📑 Obsah

1. [Prečo sme migrovali na Kustomize](#-1-prečo-sme-migrovali-na-kustomize)
2. [Čo je Kustomize a ako funguje](#-2-čo-je-kustomize-a-ako-funguje)
3. [Naše dva prístupy — Classic vs. Kustomize](#-3-naše-dva-prístupy--classic-vs-kustomize)
4. [Štruktúra projektu a súborov](#-4-štruktúra-projektu-a-súborov)
5. [Podrobný popis base súborov](#-5-podrobný-popis-base-súborov)
6. [Podrobný popis overlay súborov](#-6-podrobný-popis-overlay-súborov)
7. [Runtime konfigurácia frontendu (env.js)](#-7-runtime-konfigurácia-frontendu-envjs)
8. [Ingress, SSL a domény](#-8-ingress-ssl-a-domény)
9. [Migrácia z Classic na Kustomize (krok za krokom)](#-9-migrácia-z-classic-na-kustomize-krok-za-krokom)
10. [Nasadenie a update workflow](#-10-nasadenie-a-update-workflow)
11. [Image Promotion Workflow (dev → test → prod)](#-101-image-promotion-workflow-dev--test--prod)
12. [Best Practices a odporúčania](#-11-best-practices-a-odporúčania)
13. [Porovnávacia tabuľka Classic vs. Kustomize](#-12-porovnávacia-tabuľka-classic-vs-kustomize)
14. [Kustomize vs. Helm — kedy čo](#-13-kustomize-vs-helm--kedy-čo)
15. [Troubleshooting a časté chyby](#-14-troubleshooting-a-časté-chyby)
16. [Cheat Sheet — užitočné príkazy](#-15-cheat-sheet--užitočné-príkazy)

---

## 🎯 1. Prečo sme migrovali na Kustomize

### Problém s Classic prístupom

Keď sme začali nasadzovať aplikáciu na K3s, vytvorili sme pre každé prostredie (dev, test, prod) **samostatný kompletný YAML súbor** (~150-220 riadkov). To znamenalo:

- **3× kopírovanie** takmer identického kódu (450+ riadkov celkovo)
- **Riziko chýb** — zabudnutá zmena portu alebo premennej v jednom z prostredí
- **Zmena spoločného parametra** (napr. verzia databázy) vyžadovala úpravu na **3 miestach**
- **Ťažká údržba** — pridanie nového prostredia = kopírovanie 150+ riadkov a manuálna úprava

### Čo nám Kustomize vyriešil

- **100% DRY (Don't Repeat Yourself)** — spoločný kód je napísaný iba raz v `base/`
- **Pridanie nového prostredia = 3 minúty** — kopírovanie priečinku, zmena portu a `env.js`
- **Prehľadnosť** — otvoríš overlay a vidíš len rozdiely, žiaden balast
- **Natívna integrácia** — `kubectl apply -k` funguje bez extra nástrojov
- **Validácia pred nasadením** — `kubectl kustomize <cesta>` ukáže vygenerovaný YAML

### Reálny príklad zlepšenia

```
PRED (Classic):
├── dev-env.yaml    → 220 riadkov (kompletný manifest)
├── test-env.yaml   → 220 riadkov (99% rovnaký obsah)
└── prod-env.yaml   → 220 riadkov (99% rovnaký obsah)
CELKOM: 660 riadkov, 3 súbory

PO (Kustomize):
├── base/           → 8 súborov, ~200 riadkov (napísaný RAZ)
├── environments/dev/  → 4 súbory, ~60 riadkov (len rozdiely)
├── environments/test/ → 4 súbory, ~60 riadkov (len rozdiely)
└── environments/prod/ → 4 súbory, ~60 riadkov (len rozdiely)
CELKOM: ~380 riadkov, ale ZERO duplicita
```

---

## 📘 2. Čo je Kustomize a ako funguje

**Kustomize** je nástroj na správu Kubernetes YAML konfigurácie bez templatingu. Je súčasťou projektu Kubernetes a je **vstavaný priamo do `kubectl`** od verzie 1.14.

### Základné koncepty

| Koncept | Popis |
|---|---|
| **Base** | Priečinok so spoločnými manifestmi (Deployment, Service, PVC). Nemajú žiadny namespace. |
| **Overlay** | Priečinok, ktorý odkazuje na `base` a pridáva rozdiely (namespace, porty, konfigurácia). |
| **kustomization.yaml** | Vstupný súbor v každom priečinku. Hovorí Kustomize, čo načítať a ako zmeniť. |
| **ConfigMap Generator** | Automaticky vytvorí ConfigMap z lokálnych súborov (napr. `env.js`). |
| **Patches** | Malé YAML súbory s rozdielmi (napr. zmena portu služby). |
| **Transformers** | Automatické zmeny (napr. pridanie namespace všetkým objektom). |

### Ako to funguje v praxi

```
┌──────────────────┐          ┌──────────────────────────────┐
│    base/         │          │    environments/dev/          │
│                  │          │                              │
│  Deployments     │◄─────────│  kustomization.yaml          │
│  Services        │  odkaz   │    namespace: dev             │
│  PVC             │          │    configMapGenerator → env.js│
│  kustomization   │          │    ingress.yaml (dev doména)  │
└──────────────────┘          └──────────────────────────────┘
                                         │
                                         ▼
                              ┌──────────────────────────────┐
                              │  Výstup: Kompletný manifest  │
                              │  so všetkým v namespace: dev │
                              │  s dev ConfigMap a Ingress    │
                              └──────────────────────────────┘
```

Kustomize pipeline:
1. Načíta `resources` zo zoznamu v `kustomization.yaml`
2. Spustí generátory (ConfigMap zo súboru `env.js`)
3. Aplikuje transformery (`namespace: dev` na všetky objekty)
4. Vypíše výsledný YAML (jeden súvislý stream manifestov)

---

## ⚖ 3. Naše dva prístupy — Classic vs. Kustomize

### Classic prístup (jeden veľký YAML na prostredie)

**Súbory:** `k8s/classic/dev-env.yaml`, `test-env.yaml`, `prod-env.yaml`

Každý súbor obsahuje **kompletné** definície pre:
- Namespace
- ConfigMap (s `env.js` inline)
- PostgreSQL (PVC + Deployment + Service)
- Backend (Deployment + Service s NodePort)
- Frontend (Deployment + Service s NodePort + ConfigMap mount)
- Ingress (routing na doménu)

```yaml
# Ukážka: Celý dev-env.yaml obsahuje 220 riadkov, kde 95% je rovnaký
# kód ako test-env.yaml a prod-env.yaml.
# Rozdiely sú iba:
#   - namespace: dev vs test vs prod
#   - nodePort: 30032 vs 30031 vs 30030
#   - env.js: VITE_API_URL a ENVIRONMENT_NAME
#   - Ingress host: dev.adrianprogramuje.sk vs test vs prod
```

**Kedy je Classic OK:** Pre jednoduchý projekt s 1 prostredím, alebo keď tím ešte nepozná Kustomize.

### Kustomize prístup (base + overlays)

**Súbory:** `k8s/kustomize/base/` + `environments/dev|test|prod/`

Base obsahuje spoločné šablóny **bez namespace**. Každý overlay len odkáže na base a pridá:
- Namespace (`namespace: dev`)
- `env.js` súbor (ConfigMap generator)
- `ingress.yaml` (doména + SSL)

**Kedy je Kustomize lepší:** Vždy keď máš 2+ prostredí alebo plánuješ rásť.

---

## 📂 4. Štruktúra projektu a súborov

```
docker-task-project/
├── backend/                          # NestJS REST API
│   ├── src/
│   │   ├── main.ts                   # Vstupný bod, CORS, port
│   │   ├── app.module.ts             # TypeORM pripojenie na PostgreSQL
│   │   └── tasks/                    # CRUD modul (entity, service, controller)
│   └── Dockerfile                    # Multi-stage build
│
├── frontend/                         # React + Vite SPA
│   ├── src/
│   │   ├── App.tsx                   # Hlavný komponent (čítá window.env)
│   │   └── main.tsx
│   ├── public/env.js                 # Placeholder pre lokálny vývoj
│   ├── index.html                    # Načítava env.js cez <script> tag
│   └── Dockerfile                    # Multi-stage build → NGINX
│
├── k8s/
│   ├── classic/                      # ❌ Starý prístup (duplicitný kód)
│   │   ├── dev-env.yaml              #    ~220 riadkov (kompletný manifest)
│   │   ├── test-env.yaml             #    ~220 riadkov (takmer identický)
│   │   └── prod-env.yaml             #    ~220 riadkov (takmer identický)
│   │
│   └── kustomize/                    # ✅ Nový prístup (DRY, modulárny)
│       ├── base/                     #    Spoločný základ (napísaný RAZ)
│       │   ├── kustomization.yaml    #    Vstupný bod base
│       │   ├── postgres-pvc.yaml     #    Persistentné úložisko (1Gi)
│       │   ├── postgres-deployment.yaml  # PostgreSQL 15 Alpine
│       │   ├── postgres-service.yaml #    ClusterIP (interná DB)
│       │   ├── backend-deployment.yaml   # NestJS + env premenné
│       │   ├── backend-service.yaml  #    ClusterIP
│       │   ├── frontend-deployment.yaml  # React/NGINX + ConfigMap mount
│       │   └── frontend-service.yaml #    ClusterIP
│       │
│       └── environments/             #    Len rozdiely pre každé prostredie
│           ├── dev/
│           │   ├── kustomization.yaml    # namespace: dev + configMapGenerator
│           │   ├── env.js                # VITE_API_URL = dev.adrianprogramuje.sk
│           │   └── ingress.yaml          # dev doména + SSL (Let's Encrypt)
│           ├── test/
│           │   ├── kustomization.yaml
│           │   ├── env.js                # VITE_API_URL = test.adrianprogramuje.sk
│           │   └── ingress.yaml
│           └── prod/
│               ├── kustomization.yaml
│               ├── env.js                # VITE_API_URL = prod.adrianprogramuje.sk
│               └── ingress.yaml
│
├── kamal/                            # Kamal v2 konfigurácia (alternatíva ku K3s)
├── docker-compose.yml                # Lokálny vývoj
├── DEPLOYMENT_GUIDE.md               # Kompletný sprievodca K3s vs Kamal
├── K8S_ENV_COMPARISON.md             # Progress tracker Classic vs Kustomize
└── KUSTOMIZE_GUIDE.md                # 👈 TENTO DOKUMENT
```

---

## 🧩 5. Podrobný popis base súborov

### `base/kustomization.yaml` — Vstupný bod

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

# Zoznam všetkých spoločných manifestov.
# ⚠️ Žiadny z nich nemá napevno priradený namespace!
resources:
  - postgres-pvc.yaml
  - postgres-service.yaml
  - postgres-deployment.yaml
  - backend-service.yaml
  - backend-deployment.yaml
  - frontend-service.yaml
  - frontend-deployment.yaml
```

> **Prečo nemáme namespace v base:** Kustomize automaticky pridá namespace z overlay-u (napr. `namespace: dev`) ku **všetkým** objektom. Ak by sme mali namespace v base, bol by tam natvrdo a overlays by ho nevedeli zmeniť.

### `base/postgres-deployment.yaml` — Databáza

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres-deployment
  labels:
    app: postgres
spec:
  replicas: 1        # Vždy len 1 inštancia DB (nie je vhodné škálovať PostgreSQL takto)
  selector:
    matchLabels:
      app: postgres
  template:
    spec:
      containers:
        - name: postgres
          image: postgres:15-alpine    # Ľahký obraz (Alpine Linux)
          ports:
            - containerPort: 5432
          env:
            - name: POSTGRES_USER
              value: "postgres"
            - name: POSTGRES_PASSWORD
              value: "postgres"        # ⚠️ V produkcii zmeniť na K8s Secret!
            - name: POSTGRES_DB
              value: "postgres"
          volumeMounts:
            - name: postgres-storage
              mountPath: /var/lib/postgresql/data
      volumes:
        - name: postgres-storage
          persistentVolumeClaim:
            claimName: postgres-pvc    # Odkaz na PVC → dáta prežijú reštart
```

### `base/backend-deployment.yaml` — NestJS API

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend-deployment
spec:
  replicas: 1
  template:
    spec:
      imagePullSecrets:
        - name: dockerhub-secret       # Secret na prístup k súkromnému Docker Hubu
      containers:
        - name: backend
          image: adoosdeveloper/docker-task-test:backend-latest
          imagePullPolicy: Always       # Vždy stiahnuť najnovší obraz
          ports:
            - containerPort: 3000
          env:
            - name: DB_HOST
              value: "postgres-service" # K8s interný DNS → nájde PostgreSQL service
            - name: DB_PORT
              value: "5432"
            # ... ďalšie env premenné
```

> **Prečo `imagePullPolicy: Always`:** Keď pushneš nový obraz pod tagom `backend-latest`, chceš aby ho K8s vždy stiahol nanovo. Bez tohto by K8s použil cachovnú verziu.

### `base/frontend-deployment.yaml` — React SPA s ConfigMap

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend-deployment
spec:
  template:
    spec:
      imagePullSecrets:
        - name: dockerhub-secret
      containers:
        - name: frontend
          image: adoosdeveloper/docker-task-test:frontend-latest
          ports:
            - containerPort: 80           # NGINX v kontajneri
          volumeMounts:
            - name: config-volume
              mountPath: /usr/share/nginx/html/env.js    # Prepíše env.js v NGINX
              subPath: env.js
      volumes:
        - name: config-volume
          configMap:
            name: frontend-config         # ConfigMap generovaný Kustomize!
```

> **Kľúčový trik:** Frontend obraz je buildnutý **raz** a je rovnaký pre všetky prostredia. API URL sa nenapečie do buildu. Namiesto toho sa `env.js` mountne z ConfigMap-u pri štarte podu → každé prostredie má iný `env.js`.

### `base/postgres-service.yaml` — Interná služba

```yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres-service    # Toto meno backend používa ako DB_HOST
spec:
  selector:
    app: postgres
  ports:
    - port: 5432
  type: ClusterIP            # ⚠️ BEZPEČNÉ: Len interná, nedostupná z internetu
```

> **ClusterIP vs LoadBalancer:** PostgreSQL **nikdy** nesmie byť verejne dostupná. `ClusterIP` znamená, že iba pody v klastri (backend) sa k nej vedia pripojiť.

### `base/backend-service.yaml` a `base/frontend-service.yaml`

```yaml
# Oba sú ClusterIP v base, lebo traffic ide cez Ingress (nie NodePort)
apiVersion: v1
kind: Service
metadata:
  name: backend-service     # alebo frontend-service
spec:
  selector:
    app: backend             # alebo frontend
  ports:
    - port: 3000             # alebo 80
  type: ClusterIP
```

---

## 🔧 6. Podrobný popis overlay súborov

### `environments/dev/kustomization.yaml`

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

# 1. ZDROJE — načítame spoločný base + lokálny Ingress
resources:
  - ../../base           # ← "Daj mi všetko z base priečinka"
  - ingress.yaml         # ← Dev-špecifický Ingress (doména + SSL)

# 2. NAMESPACE — Kustomize pridá "namespace: dev" ku KAŽDÉMU objektu
namespace: dev

# 3. CONFIGMAP GENERATOR — vytvorí ConfigMap z lokálneho env.js
configMapGenerator:
  - name: frontend-config    # Meno ConfigMap-u (rovnaké ako v base deployment-e)
    files:
      - env.js               # Kustomize prečíta ./env.js a vytvorí ConfigMap
```

### `environments/dev/env.js`

```javascript
// Vývojárska konfigurácia pre frontend s HTTPS.
window.env = {
  VITE_API_URL: "https://dev.adrianprogramuje.sk",
  ENVIRONMENT_NAME: "Development"
};
```

### `environments/test/env.js`

```javascript
window.env = {
  VITE_API_URL: "https://test.adrianprogramuje.sk",
  ENVIRONMENT_NAME: "Testing"
};
```

### `environments/prod/env.js`

```javascript
window.env = {
  VITE_API_URL: "https://prod.adrianprogramuje.sk",
  ENVIRONMENT_NAME: "Production"
};
```

> **Prečo je to geniálne:** Jediný rozdiel medzi troma prostrediami je URL a názov prostredia. Kustomize z toho automaticky vygeneruje tri rôzne ConfigMapy, ktoré sa mountnú do frontend podu.

---

## 🌐 7. Runtime konfigurácia frontendu (env.js)

### Problém, ktorý sme riešili

React/Vite štandardne „napečie" premenné prostredia do JavaScript buildu (`import.meta.env.VITE_API_URL`). To znamená:
- **Musíš buildovať zvlášť** pre dev, test a prod
- **3 rôzne Docker obrazy** pre rovnakú aplikáciu
- **Zmena URL = nový build**

### Naše riešenie: Runtime konfigurácia

```
                    BUILD TIME                      RUNTIME
┌─────────────────────────────┐    ┌──────────────────────────────────┐
│  1 × docker build           │    │  Kubernetes mountne env.js       │
│  = 1 univerzálny obraz      │───▶│  z ConfigMap do NGINX priečinka  │
│  (žiadna API URL vpečená)   │    │  → Frontend čítá window.env     │
└─────────────────────────────┘    └──────────────────────────────────┘
```

**Kľúčové súbory:**

1. **`frontend/index.html`** — načíta `env.js` pred React appkou:
   ```html
   <script src="/env.js"></script>   <!-- Načíta sa ako prvý -->
   <script type="module" src="/src/main.tsx"></script>
   ```

2. **`frontend/src/App.tsx`** — číta konfiguráciu z `window.env`:
   ```typescript
   const API_URL = (window as any).env?.VITE_API_URL || 'http://localhost:3000';
   const ENV_NAME = (window as any).env?.ENVIRONMENT_NAME || 'Local';
   ```

3. **`frontend/public/env.js`** — placeholder pre lokálny vývoj:
   ```javascript
   window.env = {
     VITE_API_URL: "http://localhost:3000",
     ENVIRONMENT_NAME: "Local Development"
   };
   ```

4. **Kubernetes ConfigMap** — Kustomize nahradí `env.js` v NGINX kontajneri:
   ```yaml
   # V base/frontend-deployment.yaml:
   volumeMounts:
     - name: config-volume
       mountPath: /usr/share/nginx/html/env.js    # Prepíše placeholder
       subPath: env.js
   ```

### Výhody tohto prístupu

| Aspekt | Staré riešenie (build-time) | Naše riešenie (runtime) |
|---|---|---|
| **Počet Docker obrazov** | 3 (jeden pre každé env) | **1** (univerzálny) |
| **Zmena API URL** | Nový build + push + deploy | **Len úprava env.js** + redeploy |
| **Docker Hub úložisko** | 3× viac miesta | **1×** |
| **Build čas** | 3× | **1×** |

---

## 🔒 8. Ingress, SSL a domény

### Čo sme nastavili

Každé prostredie má vlastný Ingress s:
- **Doménou** (subdoména cez DNS A záznam na IP servera)
- **SSL/TLS certifikátom** (automaticky cez Let's Encrypt + Traefik)

### DNS záznamy (na Webglobe)

```
dev.adrianprogramuje.sk   → A → 164.92.244.115
test.adrianprogramuje.sk  → A → 164.92.244.115
prod.adrianprogramuje.sk  → A → 164.92.244.115
```

### Ingress manifest (príklad pre dev)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: websecure   # HTTPS port
    traefik.ingress.kubernetes.io/router.tls: "true"               # Zapnúť TLS
    traefik.ingress.kubernetes.io/router.tls.certresolver: myresolver  # Let's Encrypt
spec:
  tls:
    - hosts:
        - dev.adrianprogramuje.sk
      secretName: dev-cert-secret    # K8s Secret s certifikátom
  rules:
    - host: dev.adrianprogramuje.sk
      http:
        paths:
          - path: /tasks             # API požiadavky → Backend
            pathType: Prefix
            backend:
              service:
                name: backend-service
                port:
                  number: 3000
          - path: /                  # Všetko ostatné → Frontend
            pathType: Prefix
            backend:
              service:
                name: frontend-service
                port:
                  number: 80
```

### Ako funguje SSL s Traefik na K3s

K3s má Traefik ako vstavaný Ingress Controller. Pre automatické SSL certifikáty sme museli:

1. **Upraviť Traefik konfiguráciu** na serveri:
   ```bash
   # Vytvoriť/upraviť /var/lib/rancher/k3s/server/manifests/traefik-config.yaml
   apiVersion: helm.cattle.io/v1
   kind: HelmChartConfig
   metadata:
     name: traefik
     namespace: kube-system
   spec:
     valuesContent: |
       additionalArguments:
         - "--entrypoints.websecure.address=:443"
         - "--certificatesresolvers.myresolver.acme.tlschallenge=true"
         - "--certificatesresolvers.myresolver.acme.email=tvoj@email.com"
         - "--certificatesresolvers.myresolver.acme.storage=/data/acme.json"
   ```

2. **Reštartovať K3s:** `sudo systemctl restart k3s`

3. **Traefik automaticky:**
   - Vygeneruje certifikát cez Let's Encrypt
   - Uloží ho do K8s Secret
   - Obnovuje ho pred expiráciou

---

## 🔄 9. Migrácia z Classic na Kustomize (krok za krokom)

### Predpoklady
- Funkčný K3s klaster
- Docker Hub secret v každom namespace
- DNS záznamy nasmerované na server

### Krok 1: Audit existujúceho Classic YAML

Otvor napr. `dev-env.yaml` a identifikuj spoločné časti (sú rovnaké vo všetkých env):
- PostgreSQL (PVC, Deployment, Service) → `base/`
- Backend (Deployment, Service) → `base/`
- Frontend (Deployment, Service) → `base/`

A rozdiely (špecifické pre prostredie):
- Namespace → overlay `namespace:`
- ConfigMap (env.js) → overlay `configMapGenerator`
- Ingress (doména) → overlay `ingress.yaml`
- NodePort čísla → overlay patch (ak používaš NodePort)

### Krok 2: Vytvoriť base priečinok

```bash
mkdir -p k8s/kustomize/base
```

Presunúť spoločné manifesty **bez namespace** do `base/`:
- `postgres-pvc.yaml`
- `postgres-deployment.yaml`
- `postgres-service.yaml`
- `backend-deployment.yaml`
- `backend-service.yaml`
- `frontend-deployment.yaml`
- `frontend-service.yaml`

Vytvoriť `base/kustomization.yaml` s odkazmi na všetky súbory.

### Krok 3: Vytvoriť overlay priečinky

```bash
mkdir -p k8s/kustomize/environments/{dev,test,prod}
```

V každom vytvoriť:
- `kustomization.yaml` s odkazom na `../../base`
- `env.js` s konfiguráciou pre dané prostredie
- `ingress.yaml` s doménou a SSL

### Krok 4: Validácia (bez nasadenia!)

```bash
# Vygeneruje kompletný YAML pre dev — porovnaj ho s dev-env.yaml
kubectl kustomize k8s/kustomize/environments/dev

# To isté pre test a prod
kubectl kustomize k8s/kustomize/environments/test
kubectl kustomize k8s/kustomize/environments/prod
```

### Krok 5: Zmazať classic deploymenty a nasadiť Kustomize

```bash
# Na serveri:

# 1. Zmazať staré classic deploymenty
kubectl delete -f /root/k3s-config/dev-env.yaml --ignore-not-found
kubectl delete -f /root/k3s-config/test-env.yaml --ignore-not-found
kubectl delete -f /root/k3s-config/prod-env.yaml --ignore-not-found

# 2. Skopírovať Kustomize súbory na server (z lokálneho PC)
scp -r k8s/kustomize root@164.92.244.115:/root/k3s-config/

# 3. Nasadiť cez Kustomize
kubectl apply -k /root/k3s-config/kustomize/environments/dev
kubectl apply -k /root/k3s-config/kustomize/environments/test
kubectl apply -k /root/k3s-config/kustomize/environments/prod

# 4. Overiť
kubectl get pods -n dev
kubectl get pods -n test
kubectl get pods -n prod
```

---

## 🚀 10. Nasadenie a update workflow

### Prvotné nasadenie (od nuly)

```bash
# === 1. LOKÁLNE PC: Build a push Docker obrazov s VERZIOU ===

# Backend (tag = verzia, NIE "latest"!)
docker build -t adoosdeveloper/docker-task-test:backend-v1.0.0 ./backend
docker push adoosdeveloper/docker-task-test:backend-v1.0.0

# Frontend (tag = verzia, jeden obraz pre všetky env — bez VITE_API_URL!)
docker build -t adoosdeveloper/docker-task-test:frontend-v1.0.0 ./frontend
docker push adoosdeveloper/docker-task-test:frontend-v1.0.0

# === 2. LOKÁLNE PC: Nastav verziu v každom overlay-i ===
# V dev/kustomization.yaml nastav tagy na backend-v1.0.0 a frontend-v1.0.0
# V test/kustomization.yaml nastav rovnaké tagy (prvotné nasadenie)
# V prod/kustomization.yaml nastav rovnaké tagy (prvotné nasadenie)

# === 3. LOKÁLNE PC: Skopírovať Kustomize na server ===
scp -r k8s/kustomize root@164.92.244.115:/root/k3s-config/

# === 4. NA SERVERI: Vytvoriť namespaces a secrety ===
for NS in dev test prod; do
  kubectl create namespace $NS --dry-run=client -o yaml | kubectl apply -f -
  kubectl create secret docker-registry dockerhub-secret -n $NS \
    --docker-server=https://index.docker.io/v1/ \
    --docker-username="adoosdeveloper" \
    --docker-password="<TOKEN>" \
    --docker-email="<EMAIL>" --dry-run=client -o yaml | kubectl apply -f -
done

# === 5. NA SERVERI: Nasadiť všetky prostredia ===
kubectl apply -k /root/k3s-config/kustomize/environments/dev
kubectl apply -k /root/k3s-config/kustomize/environments/test
kubectl apply -k /root/k3s-config/kustomize/environments/prod
```

---

## 🔄 10.1 Verziovanie a nasadzovanie prostredí pomocou Kustomize (dev → test → prod)

### Princíp: Každé prostredie beží na vlastnej verzii obrazu

V produkcii a testovacích prostrediach **nikdy nepoužívaj tag `latest`**. Namiesto toho priraď každému prostrediu konkrétny verziovaný tag (napr. `v1.1.0`, `v1.2.0`, `v1.3.0`). To ti umožňuje udržiavať odlišné verzie a funkcie aplikácie v závislosti od prostredia:

```
┌──────────────────────────────────────────────────────────┐
│                   VERZIOVANIE PROSTREDÍ                   │
│                                                          │
│   1. DEV (Vývojové prostredie)                           │
│      - Doména: dev.adrianprogramuje.sk                   │
│      - Verzia: backend-v1.3.0 / frontend-v1.3.0          │
│      - Funkcie: Najnovšie experimental (Triedenie, atď.) │
│        │                                                 │
│        ▼ (Po otestovaní posúvame kód)                    │
│                                                          │
│   2. TEST (Testovacie prostredie / QA)                   │
│      - Doména: test.adrianprogramuje.sk                  │
│      - Verzia: backend-v1.2.0 / frontend-v1.2.0          │
│      - Funkcie: Stabilný release candidate (Štatistiky)   │
│        │                                                 │
│        ▼ (Po schválení QA posúvame kód)                  │
│                                                          │
│   3. PROD (Produkčné prostredie)                         │
│      - Doména: prod.adrianprogramuje.sk                  │
│      - Verzia: backend-v1.1.0 / frontend-v1.1.0          │
│      - Funkcie: Plne stabilný základ (Task manager)      │
└──────────────────────────────────────────────────────────┘
```

> **Kľúčové:** Keď prenášaš zmeny (napr. z dev do test), **zmeníš príslušný tag verzie v súbore `kustomization.yaml`** pre dané prostredie. Týmto spôsobom máš pod kontrolou presný stav kódu v každom prostredí a verzie sú jasne oddelené.

### Ako to funguje s Kustomize

Každý overlay (`environments/dev|test|prod/kustomization.yaml`) obsahuje sekciu `patches`, ktorá prepíše predvolený image tag z base na konkrétnu verziu pre dané prostredie:

```yaml
# environments/dev/kustomization.yaml — najnovšie funkcie (triedenie, hromadné mazanie)
patches:
  - target:
      kind: Deployment
      name: backend-deployment
    patch: |-
      - op: replace
        path: /spec/template/spec/containers/0/image
        value: adoosdeveloper/docker-task-test:backend-v1.3.0
  - target:
      kind: Deployment
      name: frontend-deployment
    patch: |-
      - op: replace
        path: /spec/template/spec/containers/0/image
        value: adoosdeveloper/docker-task-test:frontend-v1.3.0
```

```yaml
# environments/test/kustomization.yaml — verzia pre QA (štatistický widget)
patches:
  - target:
      kind: Deployment
      name: backend-deployment
    patch: |-
      - op: replace
        path: /spec/template/spec/containers/0/image
        value: adoosdeveloper/docker-task-test:backend-v1.2.0
  - target:
      kind: Deployment
      name: frontend-deployment
    patch: |-
      - op: replace
        path: /spec/template/spec/containers/0/image
        value: adoosdeveloper/docker-task-test:frontend-v1.2.0
```

```yaml
# environments/prod/kustomization.yaml — stabilná verzia pre používateľov (základná verzia)
patches:
  - target:
      kind: Deployment
      name: backend-deployment
    patch: |-
      - op: replace
        path: /spec/template/spec/containers/0/image
        value: adoosdeveloper/docker-task-test:backend-v1.1.0
  - target:
      kind: Deployment
      name: frontend-deployment
    patch: |-
      - op: replace
        path: /spec/template/spec/containers/0/image
        value: adoosdeveloper/docker-task-test:frontend-v1.1.0
```

> **Prečo JSON patch a nie `images` transformer?** Pretože oba naše obrazy (backend aj frontend) zdieľajú rovnaký Docker Hub repozitár (`docker-task-test`), líšia sa len tagom. Kustomize `images` transformer matchuje podľa mena obrazu, takže by zmenil tag obom naraz. JSON patch cieli na konkrétny Deployment, takže vieme meniť backend a frontend nezávisle.

### Krok za krokom: Nový release

#### 1. Developer zbuilduje nový obraz (lokálne PC)

```bash
# Nová verzia backendu (napr. v1.4.0)
docker build -t adoosdeveloper/docker-task-test:backend-v1.4.0 ./backend
docker push adoosdeveloper/docker-task-test:backend-v1.4.0

# Nová verzia frontendu (ak sa zmenil)
docker build -t adoosdeveloper/docker-task-test:frontend-v1.4.0 ./frontend
docker push adoosdeveloper/docker-task-test:frontend-v1.4.0
```

#### 2. Nasadenie na DEV (zmena tagu v overlay-i)

```yaml
# Uprav environments/dev/kustomization.yaml:
# Zmeň backend-v1.3.0 → backend-v1.4.0
# Zmeň frontend-v1.3.0 → frontend-v1.4.0
```

```bash
# Skopíruj a nasaď
scp -r k8s/kustomize root@164.92.244.115:/root/k3s-config/
ssh root@164.92.244.115 kubectl apply -k /root/k3s-config/kustomize/environments/dev
```

#### 3. Promovanie z DEV → TEST (po úspešnom otestovaní)

```yaml
# Uprav environments/test/kustomization.yaml:
# Zmeň backend-v1.2.0 → backend-v1.3.0  (verzia, čo bežala v dev)
# Zmeň frontend-v1.2.0 → frontend-v1.3.0
```

```bash
scp -r k8s/kustomize root@164.92.244.115:/root/k3s-config/
ssh root@164.92.244.115 kubectl apply -k /root/k3s-config/kustomize/environments/test
```

#### 4. Promovanie z TEST → PROD (po QA schválení)

```yaml
# Uprav environments/prod/kustomization.yaml:
# Zmeň backend-v1.1.0 → backend-v1.2.0  (verzia, čo prešla QA v test)
# Zmeň frontend-v1.1.0 → frontend-v1.2.0
```

```bash
scp -r k8s/kustomize root@164.92.244.115:/root/k3s-config/
ssh root@164.92.244.115 kubectl apply -k /root/k3s-config/kustomize/environments/prod
```

### 📝 Prípadová štúdia: Praktické nasadenie 3 verzií (v1.1.0, v1.2.0, v1.3.0)

Pre otestovanie tohto workflowu sme zostavili 3 reálne verzie backendu a frontendu s odstupňovanou funkcionalitou. Vďaka tomu môžeme okamžite vizuálne skontrolovať, ktorá verzia na ktorej doméne (dev/test/prod) reálne beží.

#### 1. Rozdiely vo verziách (Vizuálne zmeny)
*   **v1.1.0 (Produkcia - Stabilný základ)**: Čisté rozhranie bez akýchkoľvek extra widgetov.
*   **v1.2.0 (Testing - Pridaná analytika)**: Obsahuje **Panel štatistík úloh** (Widget zobrazujúci: Celkovo úloh, Aktívne, Dokončené a grafický progress bar úspešnosti).
*   **v1.3.0 (Development - Plná výbava)**: Obsahuje panel štatistík (v1.2.0) + **Zoradenie úloh** (dropdown pre Najnovšie, Podľa priority, Podľa stavu) + **Hromadné mazanie** (tlačidlo na vymazanie dokončených úloh).

#### 2. Prepojenie verzií: Overovanie Backend vs. Frontend
Aby sme mali istotu, že sa frontend pripája na správnu verziu backendu, implementovali sme dynamic-fetching verzie:
*   **Backend `/tasks/version`**:
    V `TasksController` sme vytvorili endpoint `@Get('version')`, ktorý vracia JSON s verziou:
    ```typescript
    @Get('version')
    getVersion(): any {
      return {
        status: 'ok',
        version: 'v1.3.0', // Mení sa podľa verzie obrazu
        message: 'Development Nightly Build'
      };
    }
    ```
    *(Poznámka: Tento endpoint je schválne umiestnený pod `/tasks/version` namiesto rootu `/`, pretože Ingress na doménu smeruje iba cestu `/tasks` na backend. Root `/` smeruje na frontend.)*

*   **Frontend**:
    Pri štarte aplikácia pošle požiadavku na `API_URL + '/version'` a získaný tag zobrazí v pätičke:
    ```typescript
    const response = await fetch(API_URL + '/version');
    const data = await response.json();
    setBackendVersion(data.version);
    ```
    V pätičke frontendu sa tak zobrazuje napr.:
    `Connected to Backend API: ... [Backend version: v1.3.0]` a pod ním `Frontend Version: v1.3.0`.

#### 3. Overenie nasadenia po rollout-e
Po nasadení zmien do Kubernetes pomocou Kustomize (`kubectl apply -k ...`) a vynútení stiahnutia zmien (`kubectl rollout restart ...`) môžeme otvoriť domény a priamo vidieť:
*   **Production**: [https://prod.adrianprogramuje.sk](https://prod.adrianprogramuje.sk) -> Ukazuje verziu **v1.1.0** (len zoznam úloh).
*   **Testing**: [https://test.adrianprogramuje.sk](https://test.adrianprogramuje.sk) -> Ukazuje verziu **v1.2.0** (zoznam úloh + štatistický widget).
*   **Development**: [https://dev.adrianprogramuje.sk](https://dev.adrianprogramuje.sk) -> Ukazuje verziu **v1.3.0** (zoznam úloh + widget + zoradenie + hromadné mazanie).

---

### Tagging stratégie

| Stratégia | Príklad | Kedy použiť |
|---|---|---|
| **Semantic Versioning** | `backend-v1.2.3` | Manuálne releasy, malé tímy |
| **Git SHA** | `backend-a1b2c3d` | CI/CD pipeline, automatizácia |
| **Dátum** | `backend-20260619` | Denné buildy |
| **Git SHA + timestamp** | `backend-a1b2c3d-20260619` | Najväčšia traceabilita |

> **Odporúčanie:** Pre začiatok použi **Semantic Versioning** (`v1.2.3`). Keď neskôr nastavíš CI/CD (GitHub Actions), prejdi na **Git SHA**, aby bol každý commit automaticky sledovateľný.

### Prečo NIE `latest`?

| Problém s `latest` | Verziovaný tag |
|---|---|
| Nevieš, aký kód beží | ✅ Presne vieš (`v1.2.3`) |
| Rollback = nový build | ✅ Rollback = zmena tagu späť |
| Všetky env bežia rovnaký kód | ✅ Každé env = iná verzia |
| Kubernetes cachovanie | ✅ Nový tag = vždy nový pull |
| `imagePullPolicy: Always` nutný | ✅ Netreba, K8s stiahne nový tag |

### Rollback (ak niečo zlyhá v produkcii)

```yaml
# Stačí vrátiť tag v prod/kustomization.yaml:
# Zmeň backend-v1.2.0 → backend-v1.1.0 (predchádzajúca stabilná)
```

```bash
scp -r k8s/kustomize root@164.92.244.115:/root/k3s-config/
ssh root@164.92.244.115 kubectl apply -k /root/k3s-config/kustomize/environments/prod
# Hotovo za 30 sekúnd, bez nového buildu!
```

### Zmena konfigurácie (napr. nová env premenná)

```bash
# 1. Uprav súbory v k8s/kustomize/ lokálne
# 2. Znova skopíruj na server
scp -r k8s/kustomize root@164.92.244.115:/root/k3s-config/

# 3. Znova aplikuj
kubectl apply -k /root/k3s-config/kustomize/environments/dev
```

---

## ✅ 11. Best Practices a odporúčania

### Filozofia Kustomize

1. **Base = definícia aplikácie, Overlays = len rozdiely**
   - Base YAML má byť čitateľný aj bez znalosti Kustomize
   - Čím menej patchov v overlay-och, tým lepšie

2. **Minimalizuj rozdiely medzi prostrediami**
   - Ak sa prod overlay odlišuje od dev v desiatkach patchov, problém je v architektúre, nie v YAML

3. **Používaj `kubectl kustomize` na validáciu v CI**
   - Pred deployom vždy overíš, že sa YAML správne skompiluje

### Docker Hub a privátny repozitár

4. **Jeden súkromný repozitár, verziované tagy**
   - Docker Hub free plan = 1 privátny repo
   - Riešenie: `docker-task-test:backend-v1.2.3` a `docker-task-test:frontend-v1.2.3`
   - Oba obrazy v jednom repozitári, rozlíšené tagmi
   - **Nikdy nepoužívaj `latest`** — vždy uvádzaj konkrétnu verziu

5. **ImagePullSecret v každom namespace**
   - K8s Secrets sú izolované podľa namespace
   - Musíš vytvoriť `dockerhub-secret` v dev, test aj prod

### Bezpečnosť

6. **PostgreSQL nikdy na LoadBalancer**
   - Vždy `ClusterIP` → prístupná len interne

7. **V produkcii zmeniť heslá**
   - Použiť K8s Secrets namiesto plain-text hodnôt v YAML
   - `synchronize: false` v TypeORM
   - CORS origin nastaviť na konkrétnu doménu

8. **SSL/HTTPS vždy**
   - Let's Encrypt + Traefik = automatické, bezplatné certifikáty

### Runtime konfigurácia

9. **Nikdy nenapekať API URL do Docker buildu**
   - Použiť `env.js` + ConfigMap mount pattern
   - 1 Docker obraz = všetky prostredia

10. **Jednoduché pridanie nového prostredia**
    - Skopírovať priečinok existujúceho prostredia
    - Zmeniť namespace, doménu a env.js
    - Hotovo za 3 minúty

---

## 📊 12. Porovnávacia tabuľka Classic vs. Kustomize

| Vlastnosť | 📂 Classic | ⚡ Kustomize |
|---|:---:|:---:|
| **Celkový počet riadkov** | ~660 (3×220) | ~380 (200 base + 60/env) |
| **Duplicitný kód** | ❌ Áno (~95% duplicita) | ✅ Nulová duplicita |
| **DRY princíp** | ❌ Nie | ✅ Áno |
| **Pridanie nového env** | 🐌 Pomalé (kopírovanie 220 riadkov) | ⚡ Rýchle (kopírovanie priečinku, ~3 min) |
| **Zmena spoločného parametra** | 🔴 Úprava na N miestach | 🟢 Úprava na 1 mieste (base) |
| **Riziko chýb** | 🔴 Vysoké | 🟢 Nízke |
| **Validácia pred deployom** | ❌ Len manuálne čítanie | ✅ `kubectl kustomize <cesta>` |
| **Krivka učenia** | 🟢 Nulová | 🟡 Nízka (pár konceptov) |
| **Deploy príkaz** | `kubectl apply -f` | `kubectl apply -k` |
| **Použitie v IT priemysle** | Výnimočne | ✅ Štandard |
| **GitOps kompatibilita** | 🟡 Základná | ✅ Natívna (ArgoCD, Flux) |

---

## 🔀 13. Kustomize vs. Helm — kedy čo

| Aspekt | Kustomize | Helm |
|---|---|---|
| **Prístup** | Čistý YAML + patche/overlays | Go templating + charty |
| **Inštalácia** | Vstavaný v kubectl | Samostatný nástroj |
| **Učenie** | Jednoduchšie | Komplexnejšie (Go templates) |
| **Multi-env** | ✅ Výborný (base + overlays) | 🟡 values-dev.yaml, values-prod.yaml |
| **Zdieľanie balíčkov** | ❌ Nepodporuje | ✅ Chart registre |
| **Release management** | ❌ Nemá | ✅ helm list, rollback, history |
| **Third-party appky** | 🟡 Ručné manifesty | ✅ Hotové charty (Prometheus, Grafana...) |
| **Čitateľnosť YAML** | ✅ Vždy čitateľný | 🟡 Templaty skrývajú YAML |

### Kedy čo použiť:

```
Tvoja vlastná aplikácia + multi-env → KUSTOMIZE ✅
Third-party software (Prometheus, Grafana) → HELM ✅
Kombinácia oboch → HELM pre dependencies + KUSTOMIZE pre tvoj kód ✅
```

> **Pre náš projekt (docker-task-project)** je Kustomize správna voľba, lebo nepotrebujeme zdieľať chart ani komplexný release management.

---

## 🔥 14. Troubleshooting a časté chyby

### ❌ `ErrImagePull` / `ImagePullBackOff`

**Príčina:** Kubernetes nevie stiahnuť Docker obraz.

```bash
# Diagnostika:
kubectl describe pod <pod-name> -n <namespace>
# Hľadaj Events → "pull access denied" alebo "does not exist"

# Najčastejšie riešenia:
# 1. Chýba dockerhub-secret v danom namespace
kubectl get secret dockerhub-secret -n dev

# 2. Nesprávny názov obrazu (pozor na tag s dvojbodkou!)
# ✅ Správne: adoosdeveloper/docker-task-test:backend-latest
# ❌ Zle:    adoosdeveloper/docker-task-test-backend:latest

# 3. Obraz nebol pushnutý
docker push adoosdeveloper/docker-task-test:backend-latest
```

### ❌ `CrashLoopBackOff`

**Príčina:** Kontajner sa spustí, padne, K8s ho opätovne reštartuje.

```bash
# Pozri logy:
kubectl logs <pod-name> -n dev
kubectl logs <pod-name> -n dev --previous   # Logy z predchádzajúceho (spadnutého) podu

# Najčastejšie:
# - Backend sa nevie pripojiť na DB (DB ešte nebeží)
# - Chýba env premenná
# - Chyba v kóde
```

### ❌ Frontend načítava, ale neukazuje tasky

**Príčina:** `env.js` má nesprávnu API URL, alebo Ingress neroutouje `/tasks` na backend.

```bash
# Overenie:
# 1. Otvor dev tools v prehliadači (F12) → Network tab
# 2. Klikni na API request → skontroluj URL

# Ak je URL zlá:
kubectl get configmap frontend-config -n dev -o yaml
# Skontroluj env.js obsah

# Ak je URL správna ale vracia 404:
kubectl get ingress -n dev
# Skontroluj, či /tasks → backend-service:3000
```

### ❌ `connection refused` na server:6443

**Príčina:** K3s služba nebeží.

```bash
sudo systemctl status k3s
sudo systemctl start k3s
# Ak stále nefunguje:
journalctl -u k3s -f
```

### ❌ SSL certifikát nefunguje

**Príčina:** Traefik nemá nastavený certresolver, alebo DNS ešte nepropagoval.

```bash
# 1. Skontroluj Ingress:
kubectl describe ingress app-ingress -n dev

# 2. Skontroluj Traefik logy:
kubectl logs -n kube-system -l app.kubernetes.io/name=traefik

# 3. Počkaj na DNS propagáciu (môže trvať až 48h, zvyčajne minúty)
nslookup dev.adrianprogramuje.sk
```

---

## 📋 15. Cheat Sheet — užitočné príkazy

### Kustomize príkazy

| Príkaz | Popis |
|---|---|
| `kubectl kustomize <cesta>` | Zobrazí vygenerovaný YAML (bez nasadenia) |
| `kubectl apply -k <cesta>` | Nasadí prostredie cez Kustomize |
| `kubectl delete -k <cesta>` | Zmaže prostredie cez Kustomize |
| `kubectl diff -k <cesta>` | Ukáže rozdiely medzi clusterom a lokálnou konfiguráciou |

### Kubernetes (kubectl) príkazy

| Príkaz | Popis |
|---|---|
| `kubectl get pods -n dev` | Zobrazí pody v dev namespace |
| `kubectl get pods -A` | Zobrazí pody vo všetkých namespace |
| `kubectl logs deployment/backend-deployment -n dev` | Logy backendu |
| `kubectl describe pod <pod> -n dev` | Detailný popis podu |
| `kubectl rollout restart deployment backend-deployment -n dev` | Reštartovať backend |
| `kubectl rollout undo deployment backend-deployment -n dev` | Rollback na predchádzajúcu verziu |
| `kubectl get ingress -n dev` | Zobrazí Ingress pravidlá |
| `kubectl get svc -n dev` | Zobrazí služby |
| `kubectl get secret -n dev` | Zobrazí secrety |
| `kubectl exec -it <pod> -n dev -- /bin/sh` | Shell do podu |

### Docker príkazy

| Príkaz | Popis |
|---|---|
| `docker build -t <tag> ./backend` | Build backend obrazu |
| `docker push <tag>` | Push na Docker Hub |
| `docker login` | Prihlásenie na Docker Hub |

### SCP (kopírovanie na server)

| Príkaz | Popis |
|---|---|
| `scp -r k8s/kustomize root@IP:/root/k3s-config/` | Skopírovať celú zložku |
| `scp k8s/kustomize/environments/dev/env.js root@IP:/root/k3s-config/kustomize/environments/dev/` | Skopírovať jeden súbor |

---

## 🏁 Záver

### Čo sme dosiahli

```
✅ Tri izolované prostredia na jednom serveri (dev, test, prod)
✅ Automatické SSL certifikáty (Let's Encrypt + Traefik)
✅ Vlastné domény pre každé prostredie
✅ Jeden Docker obraz pre všetky prostredia (runtime env.js)
✅ Súkromný Docker Hub repozitár s imagePullSecret
✅ DRY konfigurácia cez Kustomize (žiadna duplicita)
✅ Jednoduchý deploy workflow (scp + kubectl apply -k)
```

### Kam ďalej?

- **GitOps (ArgoCD/Flux):** Automatické nasadenie pri pushu do Git-u
- **CI/CD pipeline:** GitHub Actions → build → push → deploy
- **Helm pre dependencies:** Ak pridáš Redis, RabbitMQ, Prometheus → Helm charty
- **Secrets management:** SealedSecrets alebo Vault namiesto plain-text hesiel
- **Horizontal Pod Autoscaler:** Automatické škálovanie podľa záťaže

---

> 📝 **Dokument:** KUSTOMIZE_GUIDE.md — Kompletný sprievodca migráciou z Classic na Kustomize
> 📅 **Posledná aktualizácia:** Jún 2026
> 🏗️ **Projekt:** docker-task-project (NestJS + React + PostgreSQL)
> 🌐 **Server:** K3s na DigitalOcean VPS (164.92.244.115)
