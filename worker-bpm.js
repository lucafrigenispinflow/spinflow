export default {
  async fetch(request) {
    const url = new URL(request.url)
    const term = url.searchParams.get('term')
    if (!term) return new Response('missing term', { status: 400 })

    const res = await fetch(
      `https://api.tunebat.com/api/tracks/search?term=${encodeURIComponent(term)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Origin': 'https://tunebat.com',
          'Referer': 'https://tunebat.com/',
          'Accept': 'application/json'
        }
      }
    )

    const data = await res.json()
    const items = data?.data?.items
    if (!items?.length) return new Response(JSON.stringify({ bpm: null }), {
      headers: { 'Content-Type': 'application/json' }
    })

    return new Response(JSON.stringify({ bpm: Math.round(items[0].b) }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}
