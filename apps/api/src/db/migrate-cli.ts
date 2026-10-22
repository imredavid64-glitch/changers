import { migrate } from './migrate.js'
migrate().then(() => {
  console.log('done')
  process.exit(0)
}).catch((e) => {
  console.error(e)
  process.exit(1)
})
