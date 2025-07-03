import { CSSProperties, Key, useRef } from "react";
import { Component } from "./types/component";
import { OptionObjectDefinition } from "./types/object";
import { Application } from "@pixi/react";
import { Application as App, Renderer } from "pixi.js";

type RegionFunction = (
    name: string,
    assets?: Array<string>,
    options?: OptionObjectDefinition<{}>
) => Component<{
    style?: CSSProperties
    className?: string
    alt_text?: string
    regionMethod?: (app: App<Renderer>, assets: Array<string>) => Promise<void>
    key?: Key | null
}>


export const region: RegionFunction = (name, assets=[]) => {
    return ({style, className, alt_text, key, regionMethod}) => {
        const containerRef = useRef<null | HTMLDivElement>(null)

        return <div id={`region-${name}`} key={key} ref={containerRef} style={style} className={className} aria-label={alt_text}>
            <Application 
                onInit={async (app) => {
                    if(regionMethod !== undefined) await regionMethod(app, assets);
                }}
                autoStart 
                sharedTicker
                backgroundAlpha={0}
                resizeTo={containerRef} 
            />
        </div>
    }
} 