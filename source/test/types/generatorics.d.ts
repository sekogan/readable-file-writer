declare module "generatorics"
{
    function cartesian<T1,T2>(a: T1[], b: T2[]): IterableIterator<[ T1, T2 ]>;
    function combination<T>(a: T[], k?: number): IterableIterator<T[]>;
    namespace clone
    {
        function combination<T>(a: T[], k?: number): IterableIterator<T[]>;
    }
}
