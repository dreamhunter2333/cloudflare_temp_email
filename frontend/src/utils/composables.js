import { useBreakpoint, useMemo } from 'vooks'

export function useIsMobile() {
    const breakpointRef = useBreakpoint({ xs: 0, s: 768 })
    return useMemo(() => {
        return breakpointRef.value === 'xs'
    })
}
