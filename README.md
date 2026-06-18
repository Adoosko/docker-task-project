**Test K3s kubernetes a Kamal na linux serveri.**


Folder structure> frontend appka v reacte, backend v nestjs, postgresql databaza.

>.kamal = sprava kamal v2. > /config = deploy files potrebne na kamal. Rozdelene na Fe a Be + DB 
>/k8s = sprava k3s kubernetes - config manifesty pre deployment, services, persistent volumes.
>docker-compose.yml = lokalny vyvoj vsetko jednim prikazom

**k3s setup - instalacka na ubuntu:** 
curl -sfL https://get.k3s.io | sh -

Buildnut docker images fe a be + pushnut to dockerhub
nakopirovat manifest files na nas server + aplikovat pripapadne nieco upravit - deployment, services, persistent volumes, imagepullsecrets 

services urcuje typ zobrazenia - LoadBalancer = pristup zvonku, ClusterIP = pristup len z klastra (pre db je to ok, pre fe/be by malo byt LoadBalancer pokial chceme pristup zvonku )

deployment - urcuje pocet replik a image name, ports

persistent volume claim - pre db povolime napr. 2GB, aby data ostali aj po restarte podu

Nasadenie na k3s cluster> kubectl apply -f k8s/
-vsesetky manifesty nasadime naraz

Ked chceme nasadit novu verziu aplikacie, tak buildneme novu verziu docker image + updateneme image name v deployment.yaml + aplikujeme znova kubectl apply -f k8s/deployment.yaml
pod sa nanovo zrestartuje a aplikuje sa nova verzia.

Skalovanie aplikacie - menime pocet replik v deployment.yaml + aplikujeme znova kubectl apply -f k8s/deployment.yaml aleboo jednoduchsie cez scale: kubectl scale deployment backend --replicas=5



**Kamal V2 - jednoduchsie riesenie pre nasadenie.**

Kamal je postaveny nad dockerom a ssh.
Kamal setup - ovladame priamo z lokalneho pc cmd
nema servies alebo persistent volumes claim ma iba deployment. Vsetko riesi cez ssh a docker. Ma to svoje vyhody aj nevyhody. 

kamal setup: kamal setup vygeneruje .yml subor, kedze kamal je stvoreny skor na jednu apku, takze som si rozumne pomenoval subory a dal ich do slozky config: deploy.backend.yml a deploy.frontend.yml. 

tento config subor kamal potrebuje na to, aby vedel, co, kde a ako ma nasadit aplikaciu.
-ip servera
-dockerhub meno + heslo
-nazov image
-ako maju byt prepojene porty, db


ked chceme nasadit novu verziu aplikacie tak stacia nam iba 2 prikazy>

Backend (build + push + deploy automaticky)
kamal deploy -c config/deploy.backend.yml

Frontend (build + push + deploy automaticky)
kamal deploy -c config/deploy.frontend.yml




cize kamal je o dost jednoduhsi ako k3s kubernetes pre male projekty ale pokial mas vela roboty ako napriklad 100 microserviceov tak tam je kamal uz nepouzitelny. Vtedy by bol lepsi kubernetes cluster. 

ale paci sa mi flexibiilta kubernetu, jednoduche skalovanie, monitoring, a vela inych veci co kubernetes ponuka aj ta Kubernetes Lens apka co mi dava super overview co sa na serveri deje. A tiez to ze k3s je lahsia verzia kubernetu je super na testovanie. 















