import { db } from "@/lib/db";
import { session } from "@/lib/session";
import { peutAgir } from "@/lib/membres";
import { chiffrer } from "@/lib/chiffrement";
import {
  extraireChamps,
  testerConnexions,
} from "@/lib/configuration-routeur";

// Configuration routeur de l'espace : lecture renvoyee MASQUEE (jamais
// de secret vers le navigateur), ecriture chiffree en base.
type LigneConfig = {
  id: number;
  nom: string;
  variante_mikhmon: string;
  url_mikhmon: string;
  identifiant_mikhmon: string;
  adresse_routeros: string;
  utilisateur_lecture: string;
  utilisateur_correction: string;
  mikhmon_change_requis: boolean;
  updated_at: string;
};

function masquer(l: LigneConfig) {
  return {
    id: l.id,
    nom: l.nom,
    variante_mikhmon: l.variante_mikhmon,
    url_mikhmon: l.url_mikhmon,
    identifiant_mikhmon: l.identifiant_mikhmon,
    mot_de_passe_mikhmon: "configuré",
    adresse_routeros: l.adresse_routeros,
    utilisateur_lecture: l.utilisateur_lecture,
    utilisateur_correction: l.utilisateur_correction,
    mot_de_passe_correction: "configuré",
    mikhmon_change_requis: l.mikhmon_change_requis,
    updated_at: l.updated_at,
  };
}

export async function GET() {
  const { tenantId } = await session();
  try {
    const { rows } = await db.query<LigneConfig>(
      `SELECT id, nom, variante_mikhmon, url_mikhmon, identifiant_mikhmon,
        adresse_routeros, utilisateur_lecture, utilisateur_correction,
        mikhmon_change_requis, updated_at
       FROM configurations_routeurs WHERE tenant_id = $1 ORDER BY nom`,
      [tenantId],
    );
    return Response.json({ data: rows.map(masquer) });
  } catch (e) {
    console.error("[config-routeur]", e);
    return Response.json({ error: "Lecture impossible." }, { status: 500 });
  }
}

// Enregistre (ou remplace, a nom egal) la configuration d'un routeur.
// Les deux connexions sont testees AVANT ecriture : rien n'est stocke
// si le routeur ou Mikhmon ne repond pas.
export async function POST(req: Request) {
  const { tenantId, utilisateurId } = await session();
  if (!(await peutAgir({ tenantId, utilisateurId }, "admin"))) {
    return Response.json(
      { error: "Votre rôle dans cet espace ne permet pas cette action." },
      { status: 403 },
    );
  }
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const resultat = extraireChamps((corps ?? {}) as Record<string, unknown>);
  if ("erreur" in resultat) {
    return Response.json({ error: resultat.erreur }, { status: 400 });
  }
  const c = resultat.champs;

  const echec = await testerConnexions(c);
  if (echec) {
    return Response.json({ error: echec }, { status: 502 });
  }

  try {
    await db.query(
      `INSERT INTO espaces (tenant_id, utilisateur_id)
       VALUES ($1, $2) ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantId, utilisateurId],
    );
    const { rows } = await db.query<LigneConfig>(
      `INSERT INTO configurations_routeurs
         (tenant_id, utilisateur_id, nom, variante_mikhmon, url_mikhmon,
          identifiant_mikhmon, mot_de_passe_mikhmon_chiffre, adresse_routeros,
          utilisateur_lecture, mot_de_passe_lecture_chiffre,
          utilisateur_correction, mot_de_passe_correction_chiffre,
          mikhmon_change_requis, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false,now())
       ON CONFLICT (tenant_id, nom) DO UPDATE SET
         variante_mikhmon = EXCLUDED.variante_mikhmon,
         url_mikhmon = EXCLUDED.url_mikhmon,
         identifiant_mikhmon = EXCLUDED.identifiant_mikhmon,
         mot_de_passe_mikhmon_chiffre = EXCLUDED.mot_de_passe_mikhmon_chiffre,
         adresse_routeros = EXCLUDED.adresse_routeros,
         utilisateur_lecture = EXCLUDED.utilisateur_lecture,
         utilisateur_correction = EXCLUDED.utilisateur_correction,
         mot_de_passe_lecture_chiffre = EXCLUDED.mot_de_passe_lecture_chiffre,
         mot_de_passe_correction_chiffre = EXCLUDED.mot_de_passe_correction_chiffre,
         mikhmon_change_requis = false, updated_at = now()
       RETURNING id, nom, variante_mikhmon, url_mikhmon, identifiant_mikhmon,
         adresse_routeros, utilisateur_lecture, utilisateur_correction,
         mikhmon_change_requis, updated_at`,
      [
        tenantId, utilisateurId, c.nom, c.variante, c.urlMikhmon,
        c.identifiantMikhmon, chiffrer(c.motDePasseMikhmon), c.adresseRouterOS,
        c.utilisateurLecture, chiffrer(c.motDePasseLecture),
        c.utilisateurCorrection, chiffrer(c.motDePasseCorrection),
      ],
    );
    return Response.json({ data: masquer(rows[0]) }, { status: 201 });
  } catch (e) {
    console.error("[config-routeur]", e);
    return Response.json({ error: "Enregistrement impossible." },
      { status: 500 });
  }
}
