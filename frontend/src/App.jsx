import Header from "./components/Header/Header";
import Formular from "./components/Formular/Formular";

export default function App() {
  return (
    <div className="app app--map-shell">
      <Header />
      <main className="app__main">
        <Formular />
      </main>
    </div>
  );
}
