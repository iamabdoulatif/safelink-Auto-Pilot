 • La VM safelink tourne (QEMU actif, RouterOS 7.25 arm64). QuickCHR l'a déclarée prête à 14h05 (boot en ~24 s).
  • Tous les services invités sont muets : HTTP (9110), SSH (9112), Winbox (9115) et les autres — connexions refusées côté invité, alors que QEMU écoute bien côté hôte.
  • Donc l'invité a cessé de répondre après son boot. Soit une config appliquée ensuite l'a isolé (règles firewall, services coupés), soit l'invité est planté.

  Pour Winbox, le jour où l'invité répondra : connecte-toi à 127.0.0.1 port 9115 (pas 192.168.88.1, pas le port 8291 par défaut). La découverte « Neighbors » ne marchera jamais à travers le NAT QEMU — il faut
  saisir l'adresse à la main.