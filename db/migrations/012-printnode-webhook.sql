-- 012 : webhook PrintNode par espace.
--
-- PrintNode notifie l'application quand un etat d'impression change
-- (« print job state »). Le webhook est cree automatiquement par
-- l'application (POST /webhook de l'API PrintNode) a l'enregistrement
-- de la configuration : on memorise son identifiant et le secret
-- partage (chiffre, jamais reaffiche) qui arrive ensuite dans
-- l'en-tete x-printnode-webhook-secret de chaque notification.

ALTER TABLE configurations_printnode
  ADD COLUMN IF NOT EXISTS secret_webhook_chiffre text,
  ADD COLUMN IF NOT EXISTS webhook_id bigint;
