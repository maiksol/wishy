import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="no">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
