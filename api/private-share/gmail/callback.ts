export default function handler(_req: any, res: any) {
  res.writeHead(302, { Location: '/admin?gmail=connected' })
  res.end()
}
