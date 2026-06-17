# Prehľad projektu a K3s Nasadenia 🚀

Tento dokument slúži ako veľmi stručný prehľad pre partnera o tom, čo všetko sa urobilo pri prerábke a nasadzovaní našej Fullstack aplikácie do produkčného prostredia.

## 🛠 1. Čo sa urobilo (Architektúra a Docker)
- **Rozdelenie aplikácie:** Aplikácia je rozdelená na 3 hlavné časti:
  1. **Frontend** (React + Vite)
  2. **Backend** (NestJS)
  3. **Databáza** (PostgreSQL)
- **Dockerizácia:** Pre Frontend aj Backend boli vytvorené `Dockerfile` s "multi-stage" buildom (optimalizácia veľkosti a rýchlosti).
- **Lokálny vývoj:** Bol pripravený `docker-compose.yml`, vďaka ktorému je možné celú aplikáciu kedykoľvek spustiť lokálne jedným príkazom.

## 🚢 2. Príprava pre Kubernetes (K3s)
- Vytvorili sme dedikovaný priečinok `k8s/`, ktorý obsahuje kompletnú definíciu našej infraštruktúry (tzv. Manifesty).
- **Zabezpečenie dát:** Databáza má nastavený `PersistentVolumeClaim` (PVC), takže dáta prežijú aj reštart databázového servera.
- **Služby (Services):**
  - **Backend** beží na vlastnom pode a je prístupný zvonku (napr. cez NodePort/LoadBalancer).
  - **Frontend** má vlastný pod a slúži ako brána pre používateľov.
  - Všetky premenné prostredia (heslá k databáze atď.) sa nastavujú priamo v K8s (runtime), nie pri builde.

## 📝 3. Postup nasadenia (Ako to celé beží)
Ak chceme aplikáciu aktualizovať a nasadiť na server (kde beží K3s):
1. **Build a Push:** Najprv urobíme Docker image pre Frontend a Backend a pošleme ich do Docker Hub repozitára.
2. **K8s Aplikácia Manifestov:** Pripojíme sa na server a aplikujeme `.yaml` súbory z priečinka `k8s/` pomocou príkazu `kubectl apply -f k8s/`.
3. **Hotovo:** Kubernetes si sám stiahne najnovšie verzie z Docker Hubu, rozbehne ich a prepojí Backend s Databázou a Frontend s Backendom.

Celé prostredie je teraz "bullet-proof", moderné, ľahko škálovateľné a pripravené na produkciu.
