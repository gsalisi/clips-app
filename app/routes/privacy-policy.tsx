import type { V2_MetaFunction } from "@remix-run/node";

export const meta: V2_MetaFunction = () => [{ title: "PopCrop" }];

export default function PrivacyPolicy() {
    return (
        <iframe width="100%" height="100%" src="/_static/privacy-policy.html"/>
    )
}
