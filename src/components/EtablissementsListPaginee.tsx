import { useEffect, useState } from "react";
import { fetchEtablissementsBySiren } from "../services/api";
import { mapEtablissement } from "../services/mapping";

interface Props {
  siren: string;
  onSelectEtablissement: (siret: string) => void;
}

const parPage = 20;

const EtablissementsListPaginee = ({
  siren,
  onSelectEtablissement,
}: Props) => {
  const [page, setPage] = useState(1);
  const [etabs, setEtabs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!siren) {
      setEtabs([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    fetchEtablissementsBySiren(siren, page, parPage)
      .then(({ etablissements, total }) => {
        setEtabs(etablissements.map(mapEtablissement));
        setTotal(total);
      })
      .finally(() => setLoading(false));
  }, [siren, page]);

  useEffect(() => {
    setPage(1);
  }, [siren]);

  if (!siren) return null;



export default EtablissementsListPaginee;
