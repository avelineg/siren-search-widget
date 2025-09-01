import type { PropsWithChildren } from "react";


export function Subtitle({ children }: PropsWithChildren) {
return <p className="m-0 mb-2 text-[12.5px] text-gray-500">{children}</p>;
}
