import { motion } from "framer-motion";
import printerPhoto from "../assets/printer-setup.webp";

export function AboutStrip() {
  return (
    <motion.div
      className="about-strip"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <img src={printerPhoto} alt="Ender 3 V3 do Vitor, com sonda 3D Touch e webcam pro OctoPrint" loading="lazy" />
      <p>
        <strong>Ender 3 V3</strong>, controlada remotamente via <strong>OctoPrint</strong> num Raspberry Pi, com sonda{" "}
        <strong>3D Touch</strong> pro nivelamento automático e webcam pra acompanhar as impressões à distância. Modelagem em{" "}
        <strong>CadQuery</strong>/<strong>OpenSCAD</strong>, fatiamento via <strong>CuraEngine</strong> headless. Esse site
        publica o histórico automaticamente conforme as peças vão saindo da impressora.
      </p>
    </motion.div>
  );
}
