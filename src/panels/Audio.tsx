import { useState, useRef, useEffect } from "react";
import { soundEffect } from "../engine/audio";
import shield_stop from '@assets/sounds/effects/shield-stop.wav'

import * as React from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/UI/card"
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/UI/chart"
import { tick } from "@/engine/animation.timing"
import { BackToDemoMenu } from "@/components/Game/BackToDemo";

const click = soundEffect(shield_stop, { volume: 0.1 });

const chartConfig = {
    volume: {
        label: "Volume",
        color: "var(--chart-1)",
    },
    rate: {
        label: "Rate",
        color: "var(--chart-2)",
    }
}

function VisualizeAudio<ChartData extends {[key: string]: number}>(
    {
        clickEvents,
        title = "Chart",
        description = "description",
        onDataUpdate,
        config
    }: {
        clickEvents?: { [name: string]: () => void }
        onDataUpdate?: () => ChartData
        config: ChartConfig
        title: string
        description: string
    }): React.ReactElement {
    const [activeChart, setActiveChart] = React.useState<keyof typeof chartConfig>("volume")
    const [chartData, setChartData] = useState<(ChartData & { timestamp: number })[]>([]);
    const loopRef = useRef<ReturnType<typeof tick> | null>(null);
    const [isRunning, setIsRunning] = useState(true);
    const [currentData, setCurrentData] = useState<ChartData | null>(null)



    useEffect(() => {
        let lastUpdate = 0;

        loopRef.current = tick({
            onInit: () => { },
            onTick: () => {
                const now = Date.now();
                if (now - lastUpdate < 50 || !isRunning) return;
                lastUpdate = now;

                const data = (onDataUpdate?.() ?? {}) as ChartData
                setCurrentData(data)

                setChartData(prev => {
                    const maxLength = 200;
                    const newEntry = {
                        timestamp: now,
                        ...(data || {})
                    };
                    return [...prev.slice(-maxLength), newEntry];
                });
            }
        });

        loopRef.current.start?.();

        return () => loopRef.current?.stop();
    }, [isRunning]);

    const toggleRunning = () => {
        setIsRunning(prev => !prev);
    };


    const event_buttons = Object.keys(clickEvents ?? {}).map(key => {
        return <button
            className="bg-blue-600 text-white hover:cursor-pointer active:bg-blue-700 my-2 px-6 rounded-md disabled:cursor-not-allowed disabled:bg-blue-950"
            disabled={!isRunning}
            key={key}
            onClick={clickEvents![key]}
        >{key}</button>
    })

    return (
        <Card className="py-4 sm:py-0 min-w-5/12 grow m-10">
            <CardHeader className="flex flex-col items-stretch border-b !p-0 sm:flex-row justify-between">
                <div className="flex">
                    <div className="flex flex-1 flex-col justify-center gap-1 px-6 pb-3 sm:pb-0">
                        <CardTitle>{title}</CardTitle>
                        <CardDescription>{description}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <button
                            className="bg-gray-600 text-white hover:cursor-pointer active:bg-gray-700 my-2 px-6 rounded-md"
                            onClick={toggleRunning}
                        >
                            {isRunning ? "Pause" : "Play"} Chart
                        </button>
                        {event_buttons}
                    </div>
                </div>
                <div className="flex">
                    {Object.keys(config).map((key) => {
                        const chart = key as keyof typeof chartConfig
                        return (
                            <button
                                key={chart}
                                data-active={activeChart === chart}
                                className="data-[active=true]:bg-muted/50 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l sm:border-t-0 sm:border-l sm:px-8 sm:py-6"
                                onClick={() => setActiveChart(chart)}
                            >
                                <span className="text-muted-foreground text-xs">
                                    {chartConfig[chart].label}
                                </span>
                            </button>
                        )
                    })}
                </div>
            </CardHeader>
            <CardContent className="px-2 sm:p-6 sm:pt-0">
                <p className="text-center pb-4">
                    <b>Current {activeChart.charAt(0).toUpperCase() + activeChart.slice(1)} Value:</b>  {currentData !== null? currentData[activeChart]: ""}
                </p>
                <ChartContainer
                    config={chartConfig}
                    className="aspect-auto h-[250px] w-full"
                >
                    <LineChart
                        accessibilityLayer
                        data={chartData}
                        margin={{
                            left: 12,
                            right: 12,
                        }}
                    >
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="timestamp"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            minTickGap={32}
                            tickFormatter={(value) => {
                                const date = new Date(value)
                                return date.toLocaleTimeString("en-US", {
                                    minute: "2-digit",
                                    second: "2-digit",
                                })
                            }}
                        />
                        <YAxis dataKey={activeChart} />
                        <ChartTooltip
                            content={
                                <ChartTooltipContent
                                    className="w-[150px]"
                                    nameKey="volume"
                                    label="Point Values"
                                />
                            }
                        />
                        <Line
                            dataKey={activeChart}
                            type="monotone"
                            stroke={`var(--color-${activeChart})`}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                        />
                    </LineChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}

function useAudioStat<T>(default_value: T): [T, React.MutableRefObject<T>, React.Dispatch<React.SetStateAction<T>>] {
    const [stat, setStat] = useState(default_value);
    const clickVolumeRef = useRef(stat);

    useEffect(() => {
        clickVolumeRef.current = stat;
    }, [stat]);

    return [stat, clickVolumeRef, setStat]
}

function getRandomNumber(min: number, max: number): number {
    return Math.random() * (max - min) + min;
}

const LinearEffectExample = () => {
    const [click_volume, clickVolumeRef, setClickVolume] = useAudioStat(0);
    const [click_rate, clickRateRef, setClickRate] = useAudioStat(1);

    return (
        <>
            <VisualizeAudio<{ volume: number, rate: number }>
                title="Audio Modification"
                description="Visual on how the rate and volume change over time"
                onDataUpdate={() => ({
                    volume: clickVolumeRef.current,
                    rate: clickRateRef.current
                })}
                config={{
                    volume: {
                        label: "Volume",
                        color: "var(--chart-1)",
                    },
                    rate: {
                        label: "Rate",
                        color: "var(--chart-2)",
                    }
                }}
                clickEvents={{
                    Volume: () => {
                        const newVolume = click_volume >= 0.5? 0: 1.2;
                        click({
                            volume: [click_volume, newVolume],
                            ease: x => x* x* x,
                            onEnd: (type) => {
                                if (type === "volume") setClickVolume(newVolume);
                            },
                            onUpdate: (type, value) => {
                                if (type === "volume") clickVolumeRef.current = value;
                            }
                        });
                    },
                    Rate: () => {
                        const newRate = getRandomNumber(0.1, 2);
                        click({
                            speed: [click_rate, newRate],
                            ease: x => x* x* x,
                            onEnd: (type) => {
                                if (type === "rate") setClickRate(newRate);
                            },
                            onUpdate: (type, value) => {
                                if (type === "rate") clickRateRef.current = value;
                            }
                        });
                    }
                }}
            />
        </>
    );
}


export const Panel = () => {
    return <>
        <LinearEffectExample />
        <BackToDemoMenu />
    </>
};

export const name = "audio";
