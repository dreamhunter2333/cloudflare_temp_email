import { useBreakpoint, useMemo } from 'vooks'

export function useIsMobile(desktopMinWidth = 768) {
    const breakpointRef = useBreakpoint({ xs: 0, s: desktopMinWidth })
    return useMemo(() => {
        return breakpointRef.value === 'xs'
    })
}
