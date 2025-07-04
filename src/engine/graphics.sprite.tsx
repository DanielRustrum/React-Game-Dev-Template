import { CSSProperties, HTMLAttributes, memo, ReactNode, RefObject, useEffect, useRef, useState } from "react"
import { Component } from "./types/component"
import { OptionObjectDefaults, OptionObjectDefinition } from "./types/object"

type Sprite = Component<{
    state: string
    rate?: number
    tile?: number
    scale?: number
    resizeTo?: RefObject<HTMLElement>
    use_modifier?: string
    paused?: boolean
    fallback?: ReactNode

    style?: CSSProperties
    animation?: string
} & (HTMLAttributes<HTMLImageElement> | HTMLAttributes<HTMLDivElement>)>

type SpritesheetFunction = (
    src: string,
    options: OptionObjectDefinition<{
        tile_size: [height: number, width: number]
        frame_time: number
        structure: {
            [state: string]: {
                type: "animated"
                layer: number
                length: number
                loop?: boolean
                rate?: number
                transition_to?: string
            } | {
                type: "tile"
                layer: number
                length: number
            }
        }
        loading: "load" | "preload" | "lazy" | "delayed"
    }>
) => [Sprite, {
    modifier: (id: string, callback: (ctx: OffscreenCanvasRenderingContext2D, width: number, height: number) => void) => void
    load: () => Promise<true>
}]


if (document.querySelector("[data-sprite-animation]") === null) {
    const style = document.createElement("style")

    style.textContent = `
        @keyframes spriteAnimation {
            0% { object-position: var(--sprite-last-frame) var(--sprite-layer); }
            100% { object-position: 0px var(--sprite-layer); }
        }

        @keyframes spriteBackgroundAnimation {
            0% { background-position: var(--sprite-last-frame) var(--sprite-layer); }
            100% { background-position: 0px var(--sprite-layer); }
        }
    `

    style.setAttribute("data-sprite-animation", "")
    document.head.appendChild(style)
}


export const spritesheet: SpritesheetFunction = (src, options = {}) => {
    const modifiers = new Map<string, string>()
    const rerenders = new Map<string, number>()


    const opts: OptionObjectDefaults<SpritesheetFunction, 1> = {
        tile_size: [100, 100],
        frame_time: .15,
        structure: { "main": { layer: 0, length: 5 } },
        loading: "load",
        ...options
    }

    const image = new Image()

    if (opts.loading !== "delayed") {
        image.crossOrigin = "anonymous"
        image.src = src

        if (opts.loading === "preload" && image.decode) {
            image.decode().catch(() => { })
        }
    }

    const load: ReturnType<SpritesheetFunction>[1]["load"] = () => new Promise((resolve, reject) => {
        const onLoad = () => {
            cleanup()
            resolve(true)
            window.dispatchEvent(new CustomEvent("spriteLoaded"))
        }

        const onError = (_: unknown) => {
            cleanup()
            reject(new Error(`Failed to load image: ${image.src}`))
        }

        const cleanup = () => {
            image.removeEventListener('load', onLoad)
            image.removeEventListener('error', onError)
        }

        if (image.complete && image.naturalWidth !== 0) {
            resolve(true)
            return
        }

        if (opts.loading === "delayed") {
            image.crossOrigin = "anonymous"
            image.src = src
        }

        image.addEventListener('load', onLoad)
        image.addEventListener('error', onError)
    })

    const modifier = (id: string, callback: CallableFunction) => {
        const render = async () => {
            const canvas: HTMLCanvasElement | OffscreenCanvas = typeof OffscreenCanvas !== "undefined" ?
                new OffscreenCanvas(image.naturalWidth, image.naturalHeight) :
                Object.assign(
                    document.createElement("canvas"),
                    {
                        width: image.naturalWidth,
                        height: image.naturalHeight
                    }
                )

            const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D
            if (!ctx || typeof ctx.drawImage !== "function") return;

            ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight)
            await callback(ctx, image.naturalWidth, image.naturalHeight)

            const finalize = (url: string) => {
                modifiers.set(id, url)
                rerenders.set(id, Date.now())
            }

            if ("convertToBlob" in canvas) {
                const blob = await (canvas as OffscreenCanvas).convertToBlob()
                finalize(URL.createObjectURL(blob))
            } else {
                const dataURL = (canvas as HTMLCanvasElement).toDataURL()
                finalize(dataURL)
            }
        }

        if (image.complete)
            render()
        else
            image.onload = render
    }

    const Sprite: Sprite = memo(({
        state = "main",
        rate = 1,
        scale = 1,
        tile = 1,
        resizeTo,
        use_modifier = "",
        paused = false,
        fallback,

        style = {},
        animation,
        children,

        ...props
    }) => {
        const [resize_scale, setResizeScale] = useState(1)
        const imgRef = useRef<HTMLImageElement | HTMLDivElement>(null)
        const [isInView, setIsInView] = useState(opts.loading !== "lazy")
        const imageSrc = use_modifier !== "" ? modifiers.get(use_modifier) : image.src

        //* Lazy Loading Control
        useEffect(() => {
            if (opts.loading !== "lazy" || !imgRef.current) return;

            const observer = new IntersectionObserver(([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true)
                    observer.disconnect()
                }
            })

            observer.observe(imgRef.current)

            return () => observer.disconnect()
        }, [])

        //* Resize Control
        useEffect(() => {
            if (resizeTo?.current === undefined) return () => { };

            const observer = new ResizeObserver((entries) => {
                const { width, height } = entries[0].contentRect
                setResizeScale(
                    Math.min(width, height) / opts.tile_size[1]
                )
            })

            if (resizeTo.current)
                observer.observe(resizeTo.current);

            return () => {
                if (resizeTo.current)
                    observer.unobserve(resizeTo.current);
            }
        }, [])

        //* Rerender Control
        const [_, setTick] = useState(0) //? Used to Force Rerenders of the Component

        useEffect(() => {
            if (paused) return;

            const id = setInterval(() => {
                const modTime = rerenders.get(use_modifier)
                if (modTime) {
                    setTick(modTime)
                    setTimeout(() => {
                        rerenders.delete(use_modifier)
                    }, 100)
                }
            }, 100)

            return () => clearInterval(id)
        }, [use_modifier])

        useEffect(() => {
            const rerender = () => setTick((t) => t + 1)
            window.addEventListener("spriteLoaded", rerender)

            return () => window.removeEventListener("spriteLoaded", rerender)
        }, [])


        const stateConfig = opts.structure[state]
        const computedScale = resizeTo ? resize_scale : scale
        const height = opts.tile_size[0] * computedScale
        const width = opts.tile_size[1] * computedScale
        const layer = stateConfig.layer * computedScale * opts.tile_size[0]
        const offset = `-${opts.tile_size[1] * computedScale * (tile - 1)}px ${layer}px`

        if (imageSrc === "" && isInView) {
            if(fallback === undefined) return <></>;
            return <div style={{ width: width, height: height }}>{fallback}</div>
        }

        const sprite_style: React.CSSProperties = {
            height,
            width,
            imageRendering: "pixelated",
            objectFit: "cover",
            "--sprite-layer": `${layer}px`,
        } as React.CSSProperties

        if (stateConfig.type === "animated") {
            const animationName = children ? "spriteBackgroundAnimation" : "spriteAnimation"
            Object.assign(sprite_style, {
                "--sprite-last-frame": `-${opts.tile_size[1] * computedScale * stateConfig.length}px`,
                "--frames": stateConfig.length,
                "--duration": `${opts.frame_time * stateConfig.length * (1 / rate)}s`,
                animation: `${animationName} var(--duration) steps(var(--frames), start) infinite${animation ? `, ${animation}` : ""}`
            });
        }
        else
            Object.assign(
                sprite_style,
                children ?
                    {
                        backgroundPosition: offset
                    } :
                    {
                        objectPosition: offset
                    }
            );


        const combinedStyle = { ...style, ...sprite_style }

        if (children) {
            return (
                <div
                    {...props}
                    ref={imgRef as RefObject<HTMLDivElement>}
                    style={{
                        ...combinedStyle,
                        backgroundImage: isInView ? `url(${imageSrc})` : undefined,
                        backgroundSize: `${opts.tile_size[1] * computedScale * (stateConfig.length ?? 1)}px auto`,
                    }}
                >
                    {children}
                </div>
            )
        } else {
            return (
                <img
                    {...props}
                    src={isInView ? imageSrc : undefined}
                    width={width}
                    height={height}
                    ref={imgRef as RefObject<HTMLImageElement>}
                    style={combinedStyle}
                />
            )
        }
    })

    return [Sprite, {
        modifier,
        load
    }]
}
