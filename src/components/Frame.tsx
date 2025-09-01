import type { PropsWithChildren } from "react";


export default function Frame({ children }: PropsWithChildren) {
return (
<div className="flex justify-center py-2 px-2.5">
<section
className="w-full max-w-[980px] box-border p-[14px] px-4 bg-white
border-2 border-cmPrimary rounded-10 shadow-card"
>
{children}
</section>
</div>
);
}
