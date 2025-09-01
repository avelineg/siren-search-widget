export type RssCardProps = {
title: string;
link: string;
date: string;
desc: string;
};


export function RssCard({ title, link, date, desc }: RssCardProps) {
return (
<article
className="box-border max-w-card w-full mx-auto
bg-cmSoft border border-cmBorder rounded-lg
p-2.5 grid grid-rows-[auto_auto_1fr_auto] gap-2"
>
<h3 className="m-0 text-cmAccent font-bold text-[18px] leading-[1.25] line-clamp-2">
<a
href={link}
target="_blank"
rel="noopener"
className="no-underline hover:underline text-inherit block"
title={title}
>
{title}
</a>
</h3>


<p className="m-0 text-[12.5px] text-gray-500">Publié le {date}</p>


<p className="m-0 text-[13.5px] text-gray-700 line-clamp-3">{desc}</p>


<a
href={link}
target="_blank"
rel="noopener"
className="justify-self-start inline-flex items-center bg-cmPrimary text-white
px-3 py-2 rounded-md no-underline font-semibold whitespace-nowrap w-max"
>
Lire l’article
</a>
</article>
);
}
