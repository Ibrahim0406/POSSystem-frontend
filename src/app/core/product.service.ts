import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Product } from './models';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);

  getByStore(storeId: number) {
    return this.http.get<Product[]>(`/api/products/${storeId}`);
  }
}
