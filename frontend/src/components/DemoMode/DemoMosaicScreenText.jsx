import { buildDemoTextStyles } from '../../utils/demoTextStyle';

/** A screen caption stays with its panel during expansion and collapse. */
export default function DemoMosaicScreenText({ text, expanded = false }) {
  if (!text?.content || (expanded && text.hide_when_expanded)) return null;
  const styles = buildDemoTextStyles(text);
  return <div className="demo-mosaic-screen-text" style={{
    ...styles.box,
    left: `${(text.screen?.x ?? .5) * 100}%`,
    top: `${(text.screen?.y ?? .15) * 100}%`,
    height: 'auto',
    width: text.width ? `${text.width}px` : '90%',
    maxWidth: '96%',
    transform: `translate(-50%, -50%) rotate(${styles.rotation}deg)`,
  }}>
    {styles.useStrokeLayer && <span aria-hidden="true" className="demo-mosaic-screen-text__stroke" style={styles.strokeLayer}>{text.content}</span>}
    <span style={styles.fill}>{text.content}</span>
  </div>;
}
