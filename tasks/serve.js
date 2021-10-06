import spawn from 'cross-spawn'
import kleur from 'kleur'

export async function serve (flags) {
  console.log(`${kleur.bold('ENVIRONMENT')}: ${kleur.cyan().bold(flags.env)}\n`)

  // Start a local dev server
  console.log(`> ${kleur.cyan('react-scripts start')}`)

  process.env.BROWSER = 'none'
  process.env.PORT = flags.port

  const child = spawn('npx', [ 'react-scripts', 'start' ], {
    stdio: [ 'ipc' ],
  })

  child.stdout.on('data', data => process.stdout.write(data.toString()))

  child.stderr.on('data', data => process.stdout.write(data.toString()))
}
