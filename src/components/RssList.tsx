import { useEffect, useState } from "react";
import { RssCard } from "./RssCard";


type Item = { title: string; link: string; pubDate: string; description: string };


export default function RssList() {
const [items, setItems] = useState<Item[] | null>(null);
const [err, setErr] = useState<string | null>(null);


useEffect(() => {
const rssUrl = "https://www.cmexpert.fr/feed/";
const api = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;


fetch(api)
.then((r) => r.json())
.then((data) => {
if (!data.items?.length) {
setItems([]);
return;
}
setItems(data.items as Item[]);
})
.catch((e) => setErr(e.message));
}, []);


if (err) return <div className="text-[#b00020]">Erreur de chargement du flux RSS : {err}</div>;
if (items === null) return <div>Chargement…</div>;
if (items.length === 0) return <div className="text-[#b00020]">Aucun article trouvé.</div>;


return (
<div className="flex flex-col gap-3">
{items.slice(0, 9).map((it, idx) => {
const d = new Date(it.pubDate || Date.now());
const date = d.toLocaleDateString("fr-FR", {
weekday: "long",
year: "numeric",
month: "long",
day: "numeric",
});
const desc = (it.description || "").replace(/<[^>]*>/g, "").trim();


return (
<RssCard
key={idx}
title={it.title || "Sans titre"}
link={it.link || "#"}
date={date}
desc={desc}
/>
);
})}
</div>
);
}
