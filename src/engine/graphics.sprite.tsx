
import React, { createContext, memo, ReactElement, ReactNode, RefObject, useContext, useEffect, useRef, useState } from "react"
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
    animation?: string
}>

type SpritesheetFunction = (
    src: string,
    options: OptionObjectDefinition<{
        tile_size: [height: number, width: number]
        frame_time: number
        structure: {
            [state: string]: {
                type: "animated-cycle"
                layer: number
                length: number
                rate?: number
            } | {
                type: "animated-instance"
                layer: number
                length: number
                transition_to: string
                rate?: number
            } | {
                type: "tile"
                layer: number
                depth: number
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
        structure: { "main": { type: "tile", layer: 0, depth: 5 } },
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
        const imgRef = useRef<HTMLElement>(null)
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
        const computedScale = resizeTo ? resize_scale * scale : scale
        const height = opts.tile_size[0] * computedScale
        const width = opts.tile_size[1] * computedScale
        const layer = stateConfig.layer * computedScale * opts.tile_size[0]
        const offset = `-${opts.tile_size[1] * computedScale * (tile - 1)}px ${layer}px`

        if (imageSrc === "" && isInView) {
            if (fallback === undefined) return <></>;
            return <div style={{ width: width, height: height }}>{fallback}</div>
        }

        const sprite_style: React.CSSProperties = {
            height,
            width,
            imageRendering: "pixelated",
            objectFit: "cover",
            "--sprite-layer": `${layer}px`,
        } as React.CSSProperties

        if (stateConfig.type === "animated-cycle") {
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

        ; (Sprite as any).isSpriteComponent = true
        ; (Sprite as any).tile_size = opts.tile_size

    return [Sprite, {
        modifier,
        load
    }]
}


//* Sprite Stack Components
export namespace Stack {
    const StackContext = createContext<{
        baseRef: RefObject<HTMLElement>
        container_scale: number
        base_tile_size: { x: number, y: number }
    } | null>(null)

    const scaleChildren = (children: Sprite, containerScale: number, resizing: boolean) => {
        return React.Children.map(children, (child) => {
            if (
                React.isValidElement(child) &&
                (child.type as any).isSpriteComponent
            ) {
                const childScale = (child.props as any)?.scale ?? 1
                const effectiveScale = resizing ? childScale * containerScale : childScale

                return React.cloneElement(child as ReactElement<any>, {
                    scale: effectiveScale,
                })
            }
            return child
        })
    }

    const scaleBase = (children: Sprite, containerScale: number) => {
        return React.Children.map(children, (child) => {
            if (
                React.isValidElement(child) &&
                (child.type as any).isSpriteComponent
            ) {
                const childScale = (child.props as any)?.scale ?? 1
                const effectiveScale = childScale * containerScale 

                console.log("Scaling child", containerScale, effectiveScale)

                return React.cloneElement(child as ReactElement<any>, {
                    scale: effectiveScale,
                })
            }
            return child
        })
    }


    export const Container: Component<{
        scale?: number
        resizeTo?: RefObject<HTMLElement>
        base: Sprite
    }> = ({ base, resizeTo = null, scale = 1, style, children, ...props }) => {
        const baseRef = useRef<HTMLElement>(null)
        const containerRef = useRef<HTMLElement>(null)
        const [dynamicScale, setDynamicScale] = useState(scale)

        const tile_size = (base as any)?.type?.tile_size ?? [0, 0]
        const baseScale = base.props.scale ?? 1

        useEffect(() => {
            const target = resizeTo?.current
            if (!target) return

            const observer = new ResizeObserver((entries) => {
                const { width, height } = entries[0].contentRect
                const newScale = Math.min(width, height) / (tile_size[1] * baseScale)
                setDynamicScale(newScale * scale)
            })

            observer.observe(target)
            return () => observer.unobserve(target)
        }, [resizeTo?.current, tile_size, baseScale, scale])

        const isResizing = resizeTo?.current != null

        useEffect(() => {
            if (!isResizing) {
                setDynamicScale(scale)
            }
        }, [scale, isResizing])

        const scaledBase = scaleBase(base, dynamicScale) as ReactNode

        return (
            <StackContext.Provider value={{
                baseRef,
                container_scale: dynamicScale,
                base_tile_size: {
                    x: tile_size[1] * baseScale,
                    y: tile_size[0] * baseScale
                }
            }}>
                <div
                    {...props}
                    ref={containerRef as RefObject<HTMLDivElement>}
                    style={{
                        position: "relative",
                        display: "inline-block",
                        ...style,
                    }}
                >
                    <div
                        ref={baseRef as RefObject<HTMLDivElement>}
                        style={{ display: "inline-block" }}
                    >
                        {scaledBase}
                    </div>

                    {children}
                </div>
            </StackContext.Provider>
        )
    }


    export const Entity: Component<{
        x: number
        y: number
    }> = ({ x, y, style, children, ...props }) => {
        const { container_scale, base_tile_size } = useContext(StackContext)!
        const isResizing = resizeTo !== null
        const scaledBase = scaleChildren(children, container_scale, isResizing) as ReactNode

        return (
            <div
                {...props}
                style={{
                    position: "absolute",
                    left: `${(base_tile_size.x * container_scale) * x / base_tile_size.x}px`,
                    top: `${y * container_scale}px`,
                    pointerEvents: "none",
                    ...style,
                }}
            >
                {scaledBase}
            </div>
        )
    }
}