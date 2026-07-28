import { getAppName } from '@trisakay/shared';

export default function App() {
  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Admin Web App</h1>
      <p>{getAppName('admin')}</p>
    </main>
  );
}
