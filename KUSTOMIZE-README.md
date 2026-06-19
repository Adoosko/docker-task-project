moj nazor na kustomize pre k3s(kubernet)

za mna absolutny game changer a must have pre kubernetes.

co to robi vlastne? no hlavne zjednodusuje spravovanie aplikacii v kubernetes clusteri.

ako pri jednej apke kde nemame vela veci a viacero prostredi tak mi to vela neprida..

ale ked si predstavim ze mam 10 aplikacii a kazda ma 3 prostredia tak to uz je ine kafe.
V podstate vsetka duplicita je vyriesena. Tam je koncept base a overlay.

base - zakladne nastavenia pre vsetky prostredia
overlay - specificke nastavenia pre kazde prostredie (tie veci co sa menia)

napr.image tagy su rozdielne v kazdom prostredi, takze preto je logicke mat ich v overlay a base mat iba zakladne konfiguracie, ktore su pre vsetky prostredia rovnake. 

To iste aj porty, v base nemame zadefinovane porty, iba v overlay pre kazde prostredie zvlast. 

V podstate som vyskusal sa co najvaic prilizit k produkcnemu rieseniu, cize som si skusil pridat viacero prostredi, viacero verzii image, presmerovanie na domenu cez ingress , generovanie ssl certifikatov cez Lets Encrypt

Cele som to najprv vyskusal klasickym posobom (bez kustomize) funogvalo vsetko ako ma ale hej chcel som nieco zmenit, tak som musel zmenit vela suborov v kazdom prostredi zvlast.. to bolo peklo :D.. 

No a to som vlastne premigroval na kustomize ved vidis aj v folder structure, tam mam aj classic aj kustomize cestu. A teraz ked chcem upravit nieco tak to robim v kustomize a len v base alebo overlay. Kedze vsetko je konfigurovatelne cez premenne tak to viem prisposobit kazdemu prostrediu zvlast. Napr zmenit image, porty, domenu, ssl certifikaty, atd..

Za mna by som toto kustomize urcite pouzil v praxi. Precitaj si aj ten KUSTOMIZE-GUIDE.md- tam je vlastne vsetko detailne opisane.. myslism ze velmi pekne zhrnute a pochopitelne. Aj navod ako premigrovat, best practises, cheat sheet


Takze na zaver by som povedal ze urcite ist do toho ak by som mal viacej prostredi a viacero aplikacii a chcel by som mat vsetko pekne zorganizovane a prehladne a nechcel by som kopirovat vela veci zbytocne 

Na druhu stranu som cital aj nazory druhych na reddite a inych forach
a vadia im tieto veci>

1. ked mas vela env, regionov alebo variantov tak je toho uz vela a je to neprehladne - tazko sa sleduje
2. nedostatok logiky ak potrebujes if else , slucky, podmeniky alebo parametrizaciu tak je tam limitacia a musis vymyslat workaournds
3. niektorym zase vadilo ze kustomize je len renderovanie yaml nie realsese system s historiou, rollbackmi a stavom nasadenia - na to su lepsie nastroje ako helm















