import spawn from 'cross-spawn'
import kleur from 'kleur'

export async function serve (flags) {
  // Start a local dev server
  console.log(`> ${kleur.cyan('react-scripts start')}`)

  process.env.BROWSER = 'none'
  process.env.PORT = flags.port

  spawn.sync('npx', [ 'react-scripts', 'start' ], {
    stdio: 'inherit',
  })
}
