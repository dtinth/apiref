import { Layout } from '~/Layout'

export default function Index() {
  return (
    <Layout>
      <div className="prose prose-invert max-w-none">
        <h1>apiref</h1>
        <div className="prose-xl">
          <p>
            Automatically generated API reference sites for{' '}
            <abbr title="JavaScript" className="no-underline">
              JS
            </abbr>{' '}
            and{' '}
            <abbr title="TypeScript" className="no-underline">
              TS
            </abbr>{' '}
            libraries that use{' '}
            <a href="https://api-extractor.com/">API Extractor</a>.
          </p>
        </div>
        <h2>How to publish an API reference to this site</h2>
        <div className="prose-lg">
          <ol>
            <li>
              <p>
                Use{' '}
                <a href="https://api-extractor.com/">
                  @microsoft/api-extractor
                </a>{' '}
                to{' '}
                <a href="https://api-extractor.com/pages/setup/generating_docs/">
                  generate a doc model file
                </a>
                .
              </p>
              <p>
                If done correctly, you should have a <code>.api.json</code> file
                in your project.
              </p>
            </li>
            <li>
              <p>
                Add <code>docModel</code> field to your{' '}
                <code>package.json</code> file.
              </p>
            </li>
            <li>
              <p>Publish your package to npm.</p>
            </li>
            <li>
              <p>
                Access the docs from <code>{'/{your-package-name}'}</code>.
              </p>
            </li>
          </ol>
        </div>
      </div>
    </Layout>
  )
}
