export function getDénomination(item: any): string {
  return (
    item?.denomination ||
    item?.nom_raison_sociale ||
    item?.name ||
    item?.raison_sociale ||
    item?.nom_commercial ||
    ""
  );
}
