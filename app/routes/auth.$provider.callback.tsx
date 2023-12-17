import { LoaderArgs } from '@remix-run/node'
import { SocialsProvider } from 'remix-auth-socials'
import { authenticator } from '~/auth.server'

export let loader = ({ request, params }: LoaderArgs) => {
  return authenticator.authenticate(params?.provider!, request, {
    successRedirect: '/app',
    failureRedirect: '/app/login?error=true',
  })
}