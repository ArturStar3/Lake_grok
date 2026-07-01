import Header from "./components/Header/Header";
import Formular from "./components/Formular/Formular";

export default function App() {
  return (
    <div className="app">
      <Header />
      <main>
        <Formular />
      </main>
      {/* <Footer /> */}
    </div>
  );
}