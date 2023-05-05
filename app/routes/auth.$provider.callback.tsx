import { LoaderArgs } from '@remix-run/node'
import { SocialsProvider } from 'remix-auth-socials'
import { authenticator } from '~/auth.server'

export let loader = ({ request }: LoaderArgs) => {
  return authenticator.authenticate(SocialsProvider.GOOGLE, request, {
    successRedirect: '/app',
    failureRedirect: '/app',
  })
}