import React from "react";
import { Composition } from "remotion";
import { PisaShort, PISA_FRAMES } from "./videos/pisa/Pisa";
import { EscudeiroShort, EscudeiroBG, ESC_FRAMES } from "./videos/escudeiro/Escudeiro";
import { VasaShort, VASA_FRAMES } from "./videos/vasa/Vasa";
import { CoroaShort, CoroaBG, COROA_FRAMES } from "./videos/coroa/Coroa";
// Cada desenho novo: copie templates/pisa/ para src/videos/<nome>/, renomeie e registre aqui.
export const Root: React.FC = () => (
  <>
    <Composition id="PisaShort" component={PisaShort} durationInFrames={PISA_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="EscudeiroEp1" component={EscudeiroShort} durationInFrames={ESC_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="EscudeiroBG" component={EscudeiroBG} durationInFrames={ESC_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="CoroaP1" component={CoroaShort} durationInFrames={COROA_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="CoroaBG" component={CoroaBG} durationInFrames={COROA_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="VasaShort" component={VasaShort} durationInFrames={VASA_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
