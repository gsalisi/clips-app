import { ActionArgs, redirect } from "@remix-run/node"
import invariant from "tiny-invariant";
import { authenticator } from '~/auth.server';

export let loader = () => redirect('/app/login');

export let action = async ({ request, params }: ActionArgs) => {
    invariant(params.provider, "$provider should always be provided")
    console.log(`Authenticating with ${params.provider}`)
    return authenticator.authenticate(params.provider, request);
};